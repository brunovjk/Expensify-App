import {Str} from 'expensify-common';
import React, {useCallback, useContext, useEffect, useMemo, useState} from 'react';
import {View} from 'react-native';
import type {OnyxEntry} from 'react-native-onyx';
import type {ValueOf} from 'type-fest';
import Avatar from '@components/Avatar';
import Button from '@components/Button';
import ButtonDisabledWhenOffline from '@components/Button/ButtonDisabledWhenOffline';
import ConfirmModal from '@components/ConfirmModal';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import * as Expensicons from '@components/Icon/Expensicons';
import {LockedAccountContext} from '@components/LockedAccountModalProvider';
import MenuItem from '@components/MenuItem';
import MenuItemWithTopDescription from '@components/MenuItemWithTopDescription';
import OfflineWithFeedback from '@components/OfflineWithFeedback';
import ScreenWrapper from '@components/ScreenWrapper';
import ScrollView from '@components/ScrollView';
import Text from '@components/Text';
import useCardFeeds from '@hooks/useCardFeeds';
import useCurrentUserPersonalDetails from '@hooks/useCurrentUserPersonalDetails';
import useExpensifyCardFeeds from '@hooks/useExpensifyCardFeeds';
import useLocalize from '@hooks/useLocalize';
import useOnyx from '@hooks/useOnyx';
import usePrevious from '@hooks/usePrevious';
import useStyleUtils from '@hooks/useStyleUtils';
import useThemeIllustrations from '@hooks/useThemeIllustrations';
import useThemeStyles from '@hooks/useThemeStyles';
import {setPolicyPreventSelfApproval} from '@libs/actions/Policy/Policy';
import {removeApprovalWorkflow as removeApprovalWorkflowAction, updateApprovalWorkflow} from '@libs/actions/Workflow';
import {getAllCardsForWorkspace, getCardFeedIcon, getCompanyFeeds, getPlaidInstitutionIconUrl, isExpensifyCardFullySetUp, lastFourNumbersFromCardName, maskCardNumber} from '@libs/CardUtils';
import {convertToDisplayString} from '@libs/CurrencyUtils';
import navigateAfterInteraction from '@libs/Navigation/navigateAfterInteraction';
import type {PlatformStackScreenProps} from '@libs/Navigation/PlatformStackNavigation/types';
import {getDisplayNameOrDefault, getPhoneNumber} from '@libs/PersonalDetailsUtils';
import {isControlPolicy} from '@libs/PolicyUtils';
import shouldRenderTransferOwnerButton from '@libs/shouldRenderTransferOwnerButton';
import {convertPolicyEmployeesToApprovalWorkflows, updateWorkflowDataOnApproverRemoval} from '@libs/WorkflowUtils';
import Navigation from '@navigation/Navigation';
import type {SettingsNavigatorParamList} from '@navigation/types';
import NotFoundPage from '@pages/ErrorPage/NotFoundPage';
import AccessOrNotFoundWrapper from '@pages/workspace/AccessOrNotFoundWrapper';
import type {WithPolicyAndFullscreenLoadingProps} from '@pages/workspace/withPolicyAndFullscreenLoading';
import withPolicyAndFullscreenLoading from '@pages/workspace/withPolicyAndFullscreenLoading';
import type {ListItemType} from '@pages/workspace/WorkspaceMemberRoleSelectionModal';
import WorkspaceMemberDetailsRoleSelectionModal from '@pages/workspace/WorkspaceMemberRoleSelectionModal';
import variables from '@styles/variables';
import {setIssueNewCardStepAndData} from '@userActions/Card';
import {
    clearWorkspaceOwnerChangeFlow,
    isApprover as isApproverUserAction,
    openPolicyMemberProfilePage,
    removeMembers,
    requestWorkspaceOwnerChange,
    updateWorkspaceMembersRole,
} from '@userActions/Policy/Member';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import type SCREENS from '@src/SCREENS';
import type {CompanyCardFeed, Card as MemberCard, PersonalDetails, PersonalDetailsList} from '@src/types/onyx';

type WorkspacePolicyOnyxProps = {
    /** Personal details of all users */
    personalDetails: OnyxEntry<PersonalDetailsList>;
};

type WorkspaceMemberDetailsPageProps = Omit<WithPolicyAndFullscreenLoadingProps, 'route'> &
    WorkspacePolicyOnyxProps &
    PlatformStackScreenProps<SettingsNavigatorParamList, typeof SCREENS.WORKSPACE.MEMBER_DETAILS>;

function WorkspaceMemberDetailsPage({personalDetails, policy, route}: WorkspaceMemberDetailsPageProps) {
    const policyID = route.params.policyID;
    const workspaceAccountID = policy?.workspaceAccountID ?? CONST.DEFAULT_NUMBER_ID;

    const styles = useThemeStyles();
    const {formatPhoneNumber, translate, localeCompare} = useLocalize();
    const StyleUtils = useStyleUtils();
    const illustrations = useThemeIllustrations();
    const currentUserPersonalDetails = useCurrentUserPersonalDetails();
    const [cardFeeds] = useCardFeeds(policyID);
    const [cardList] = useOnyx(`${ONYXKEYS.COLLECTION.WORKSPACE_CARDS_LIST}`, {canBeMissing: true});
    const [customCardNames] = useOnyx(ONYXKEYS.NVP_EXPENSIFY_COMPANY_CARDS_CUSTOM_NAMES, {canBeMissing: true});
    const expensifyCardSettings = useExpensifyCardFeeds(policyID);

    const [isRemoveMemberConfirmModalVisible, setIsRemoveMemberConfirmModalVisible] = useState(false);
    const [isRoleSelectionModalVisible, setIsRoleSelectionModalVisible] = useState(false);

    const accountID = Number(route.params.accountID);
    const memberLogin = personalDetails?.[accountID]?.login ?? '';
    const member = policy?.employeeList?.[memberLogin];
    const prevMember = usePrevious(member);
    const details = personalDetails?.[accountID] ?? ({} as PersonalDetails);
    const fallbackIcon = details.fallbackIcon ?? '';
    const displayName = formatPhoneNumber(getDisplayNameOrDefault(details));
    const isSelectedMemberOwner = policy?.owner === details.login;
    const isSelectedMemberCurrentUser = accountID === currentUserPersonalDetails?.accountID;
    const isCurrentUserAdmin = policy?.employeeList?.[personalDetails?.[currentUserPersonalDetails?.accountID]?.login ?? '']?.role === CONST.POLICY.ROLE.ADMIN;
    const isCurrentUserOwner = policy?.owner === currentUserPersonalDetails?.login;
    const ownerDetails = useMemo(() => personalDetails?.[policy?.ownerAccountID ?? CONST.DEFAULT_NUMBER_ID] ?? ({} as PersonalDetails), [personalDetails, policy?.ownerAccountID]);
    const policyOwnerDisplayName = formatPhoneNumber(getDisplayNameOrDefault(ownerDetails)) ?? policy?.owner ?? '';
    const hasMultipleFeeds = Object.keys(getCompanyFeeds(cardFeeds, false, true)).length > 0;
    const workspaceCards = getAllCardsForWorkspace(workspaceAccountID, cardList, cardFeeds, expensifyCardSettings);
    const isSMSLogin = Str.isSMSLogin(memberLogin);
    const phoneNumber = getPhoneNumber(details);
    const {isAccountLocked, showLockedAccountModal} = useContext(LockedAccountContext);

    const policyApproverEmail = policy?.approver;
    const {approvalWorkflows} = useMemo(
        () =>
            convertPolicyEmployeesToApprovalWorkflows({
                employees: policy?.employeeList ?? {},
                defaultApprover: policyApproverEmail ?? policy?.owner ?? '',
                personalDetails: personalDetails ?? {},
                localeCompare,
            }),
        [personalDetails, policy?.employeeList, policy?.owner, policyApproverEmail, localeCompare],
    );

    useEffect(() => {
        openPolicyMemberProfilePage(policyID, accountID);
    }, [policyID, accountID]);

    const memberCards = useMemo(() => {
        if (!workspaceCards) {
            return [];
        }
        return Object.values(workspaceCards ?? {}).filter((card) => card.accountID === accountID);
    }, [accountID, workspaceCards]);

    const confirmModalPrompt = useMemo(() => {
        const isApprover = isApproverUserAction(policy, accountID);
        if (!isApprover) {
            return translate('workspace.people.removeMemberPrompt', {memberName: displayName});
        }
        return translate('workspace.people.removeMembersWarningPrompt', {
            memberName: displayName,
            ownerName: policyOwnerDisplayName,
        });
    }, [accountID, policy, displayName, policyOwnerDisplayName, translate]);

    const roleItems: ListItemType[] = useMemo(
        () => [
            {
                value: CONST.POLICY.ROLE.ADMIN,
                text: translate('common.admin'),
                alternateText: translate('workspace.common.adminAlternateText'),
                isSelected: member?.role === CONST.POLICY.ROLE.ADMIN,
                keyForList: CONST.POLICY.ROLE.ADMIN,
            },
            {
                value: CONST.POLICY.ROLE.AUDITOR,
                text: translate('common.auditor'),
                alternateText: translate('workspace.common.auditorAlternateText'),
                isSelected: member?.role === CONST.POLICY.ROLE.AUDITOR,
                keyForList: CONST.POLICY.ROLE.AUDITOR,
            },
            {
                value: CONST.POLICY.ROLE.USER,
                text: translate('common.member'),
                alternateText: translate('workspace.common.memberAlternateText'),
                isSelected: member?.role === CONST.POLICY.ROLE.USER,
                keyForList: CONST.POLICY.ROLE.USER,
            },
        ],
        [member?.role, translate],
    );

    useEffect(() => {
        if (!prevMember || prevMember?.pendingAction === CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE || member?.pendingAction !== CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE) {
            return;
        }
        navigateAfterInteraction(() => Navigation.goBack());
    }, [member, prevMember]);

    const askForConfirmationToRemove = () => {
        setIsRemoveMemberConfirmModalVisible(true);
    };

    // Function to remove a member and close the modal
    const removeMemberAndCloseModal = useCallback(() => {
        removeMembers([accountID], policyID);
        const previousEmployeesCount = Object.keys(policy?.employeeList ?? {}).length;
        const remainingEmployeeCount = previousEmployeesCount - 1;
        if (remainingEmployeeCount === 1 && policy?.preventSelfApproval) {
            // We can't let the "Prevent Self Approvals" enabled if there's only one workspace user
            setPolicyPreventSelfApproval(route.params.policyID, false);
        }
        setIsRemoveMemberConfirmModalVisible(false);
    }, [accountID, policy?.employeeList, policy?.preventSelfApproval, policyID, route.params.policyID]);

    const removeUser = useCallback(() => {
        const ownerEmail = ownerDetails?.login;
        const removedApprover = personalDetails?.[accountID];

        // If the user is not an approver, proceed with member removal
        if (!isApproverUserAction(policy, accountID) || !removedApprover?.login || !ownerEmail) {
            removeMemberAndCloseModal();
            return;
        }

        // Update approval workflows after approver removal
        const updatedWorkflows = updateWorkflowDataOnApproverRemoval({
            approvalWorkflows,
            removedApprover,
            ownerDetails,
        });

        updatedWorkflows.forEach((workflow) => {
            if (workflow?.removeApprovalWorkflow) {
                const {removeApprovalWorkflow, ...updatedWorkflow} = workflow;

                removeApprovalWorkflowAction(policyID, updatedWorkflow);
            } else {
                updateApprovalWorkflow(policyID, workflow, [], []);
            }
        });

        // Remove the member and close the modal
        removeMemberAndCloseModal();
    }, [accountID, approvalWorkflows, ownerDetails, personalDetails, policy, policyID, removeMemberAndCloseModal]);

    const navigateToProfile = useCallback(() => {
        Navigation.navigate(ROUTES.PROFILE.getRoute(accountID, Navigation.getActiveRoute()));
    }, [accountID]);

    const navigateToDetails = useCallback(
        (card: MemberCard) => {
            if (card.bank === CONST.EXPENSIFY_CARD.BANK) {
                Navigation.navigate(ROUTES.WORKSPACE_EXPENSIFY_CARD_DETAILS.getRoute(policyID, card.cardID.toString(), Navigation.getActiveRoute()));
                return;
            }
            Navigation.navigate(ROUTES.WORKSPACE_COMPANY_CARD_DETAILS.getRoute(policyID, card.cardID.toString(), card.bank, Navigation.getActiveRoute()));
        },
        [policyID],
    );

    const handleIssueNewCard = useCallback(() => {
        if (isAccountLocked) {
            showLockedAccountModal();
            return;
        }

        if (hasMultipleFeeds) {
            Navigation.navigate(ROUTES.WORKSPACE_MEMBER_NEW_CARD.getRoute(policyID, accountID));
            return;
        }
        const activeRoute = Navigation.getActiveRoute();

        setIssueNewCardStepAndData({
            step: CONST.EXPENSIFY_CARD.STEP.CARD_TYPE,
            data: {
                assigneeEmail: memberLogin,
            },
            isEditing: false,
            isChangeAssigneeDisabled: true,
            policyID,
        });
        Navigation.navigate(ROUTES.WORKSPACE_EXPENSIFY_CARD_ISSUE_NEW.getRoute(policyID, activeRoute));
    }, [accountID, hasMultipleFeeds, memberLogin, policyID, isAccountLocked, showLockedAccountModal]);

    const openRoleSelectionModal = useCallback(() => {
        setIsRoleSelectionModalVisible(true);
    }, []);

    const changeRole = useCallback(
        ({value}: ListItemType) => {
            setIsRoleSelectionModalVisible(false);
            updateWorkspaceMembersRole(policyID, [accountID], value);
        },
        [accountID, policyID],
    );

    const startChangeOwnershipFlow = useCallback(() => {
        clearWorkspaceOwnerChangeFlow(policyID);
        requestWorkspaceOwnerChange(policyID);
        Navigation.navigate(ROUTES.WORKSPACE_OWNER_CHANGE_CHECK.getRoute(policyID, accountID, 'amountOwed' as ValueOf<typeof CONST.POLICY.OWNERSHIP_ERRORS>));
    }, [accountID, policyID]);

    // eslint-disable-next-line rulesdir/no-negated-variables
    const shouldShowNotFoundPage =
        !member || (member.pendingAction === CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE && prevMember?.pendingAction === CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE);

    if (shouldShowNotFoundPage) {
        return <NotFoundPage />;
    }

    const shouldShowCardsSection = Object.values(expensifyCardSettings ?? {}).some((cardSettings) => isExpensifyCardFullySetUp(policy, cardSettings)) || hasMultipleFeeds;

    return (
        <AccessOrNotFoundWrapper
            policyID={policyID}
            accessVariants={[CONST.POLICY.ACCESS_VARIANTS.ADMIN, CONST.POLICY.ACCESS_VARIANTS.PAID]}
        >
            <ScreenWrapper
                enableEdgeToEdgeBottomSafeAreaPadding
                testID={WorkspaceMemberDetailsPage.displayName}
            >
                <HeaderWithBackButton
                    title={displayName}
                    subtitle={policy?.name}
                />
                <ScrollView addBottomSafeAreaPadding>
                    <View style={[styles.containerWithSpaceBetween, styles.pointerEventsBoxNone, styles.justifyContentStart]}>
                        <View style={[styles.avatarSectionWrapper, styles.pb0]}>
                            <OfflineWithFeedback pendingAction={details.pendingFields?.avatar}>
                                <Avatar
                                    containerStyles={[styles.avatarXLarge, styles.mb4, styles.noOutline]}
                                    imageStyles={[styles.avatarXLarge]}
                                    source={details.avatar}
                                    avatarID={accountID}
                                    type={CONST.ICON_TYPE_AVATAR}
                                    size={CONST.AVATAR_SIZE.X_LARGE}
                                    fallbackIcon={fallbackIcon}
                                />
                            </OfflineWithFeedback>
                            {!!(details.displayName ?? '') && (
                                <Text
                                    style={[styles.textHeadline, styles.pre, styles.mb8, styles.w100, styles.textAlignCenter]}
                                    numberOfLines={1}
                                >
                                    {displayName}
                                </Text>
                            )}
                            {isSelectedMemberOwner && isCurrentUserAdmin && !isCurrentUserOwner ? (
                                shouldRenderTransferOwnerButton() && (
                                    <ButtonDisabledWhenOffline
                                        text={translate('workspace.people.transferOwner')}
                                        onPress={startChangeOwnershipFlow}
                                        icon={Expensicons.Transfer}
                                        style={styles.mb5}
                                    />
                                )
                            ) : (
                                <Button
                                    text={translate('workspace.people.removeWorkspaceMemberButtonTitle')}
                                    onPress={isAccountLocked ? showLockedAccountModal : askForConfirmationToRemove}
                                    isDisabled={isSelectedMemberOwner || isSelectedMemberCurrentUser}
                                    icon={Expensicons.RemoveMembers}
                                    style={styles.mb5}
                                />
                            )}
                            <ConfirmModal
                                danger
                                title={translate('workspace.people.removeMemberTitle')}
                                isVisible={isRemoveMemberConfirmModalVisible}
                                onConfirm={removeUser}
                                onCancel={() => setIsRemoveMemberConfirmModalVisible(false)}
                                prompt={confirmModalPrompt}
                                confirmText={translate('common.remove')}
                                cancelText={translate('common.cancel')}
                            />
                        </View>
                        <View style={styles.w100}>
                            <MenuItemWithTopDescription
                                title={isSMSLogin ? formatPhoneNumber(phoneNumber ?? '') : memberLogin}
                                copyValue={isSMSLogin ? formatPhoneNumber(phoneNumber ?? '') : memberLogin}
                                description={translate(isSMSLogin ? 'common.phoneNumber' : 'common.email')}
                                interactive={false}
                            />
                            <MenuItemWithTopDescription
                                disabled={isSelectedMemberOwner || isSelectedMemberCurrentUser}
                                title={translate(`workspace.common.roleName`, {role: member?.role})}
                                description={translate('common.role')}
                                shouldShowRightIcon
                                onPress={openRoleSelectionModal}
                            />
                            {isControlPolicy(policy) && (
                                <>
                                    <OfflineWithFeedback pendingAction={member?.pendingFields?.employeeUserID}>
                                        <MenuItemWithTopDescription
                                            description={translate('workspace.common.customField1')}
                                            title={member?.employeeUserID}
                                            shouldShowRightIcon
                                            onPress={() => Navigation.navigate(ROUTES.WORKSPACE_CUSTOM_FIELDS.getRoute(policyID, accountID, 'customField1'))}
                                        />
                                    </OfflineWithFeedback>
                                    <OfflineWithFeedback pendingAction={member?.pendingFields?.employeePayrollID}>
                                        <MenuItemWithTopDescription
                                            description={translate('workspace.common.customField2')}
                                            title={member?.employeePayrollID}
                                            shouldShowRightIcon
                                            onPress={() => Navigation.navigate(ROUTES.WORKSPACE_CUSTOM_FIELDS.getRoute(policyID, accountID, 'customField2'))}
                                        />
                                    </OfflineWithFeedback>
                                </>
                            )}
                            <MenuItem
                                style={styles.mb5}
                                title={translate('common.profile')}
                                icon={Expensicons.Info}
                                onPress={navigateToProfile}
                                shouldShowRightIcon
                            />
                            <WorkspaceMemberDetailsRoleSelectionModal
                                isVisible={isRoleSelectionModalVisible}
                                items={roleItems}
                                onRoleChange={changeRole}
                                onClose={() => setIsRoleSelectionModalVisible(false)}
                            />
                            {shouldShowCardsSection && (
                                <>
                                    <View style={[styles.ph5, styles.pv3]}>
                                        <Text style={StyleUtils.combineStyles([styles.sidebarLinkText, styles.optionAlternateText, styles.textLabelSupporting])}>
                                            {translate('walletPage.assignedCards')}
                                        </Text>
                                    </View>
                                    {memberCards.map((memberCard) => {
                                        const isCardDeleted = memberCard.pendingAction === CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE;
                                        const plaidUrl = getPlaidInstitutionIconUrl(memberCard?.bank);

                                        return (
                                            <OfflineWithFeedback
                                                key={`${memberCard.nameValuePairs?.cardTitle}_${memberCard.cardID}`}
                                                errorRowStyles={styles.ph5}
                                                errors={memberCard.errors}
                                                pendingAction={memberCard.pendingAction}
                                            >
                                                <MenuItem
                                                    key={memberCard.cardID}
                                                    title={
                                                        memberCard.nameValuePairs?.cardTitle ??
                                                        customCardNames?.[memberCard.cardID] ??
                                                        maskCardNumber(memberCard?.cardName ?? '', memberCard.bank)
                                                    }
                                                    description={memberCard?.lastFourPAN ?? lastFourNumbersFromCardName(memberCard?.cardName)}
                                                    badgeText={memberCard.bank === CONST.EXPENSIFY_CARD.BANK ? convertToDisplayString(memberCard.nameValuePairs?.unapprovedExpenseLimit) : ''}
                                                    icon={getCardFeedIcon(memberCard.bank as CompanyCardFeed, illustrations)}
                                                    plaidUrl={plaidUrl}
                                                    displayInDefaultIconColor
                                                    iconStyles={styles.cardIcon}
                                                    iconType={plaidUrl ? CONST.ICON_TYPE_PLAID : CONST.ICON_TYPE_ICON}
                                                    iconWidth={variables.cardIconWidth}
                                                    iconHeight={variables.cardIconHeight}
                                                    onPress={() => navigateToDetails(memberCard)}
                                                    shouldRemoveHoverBackground={isCardDeleted}
                                                    disabled={isCardDeleted}
                                                    shouldShowRightIcon={!isCardDeleted}
                                                    style={[isCardDeleted ? styles.offlineFeedback.deleted : {}]}
                                                />
                                            </OfflineWithFeedback>
                                        );
                                    })}
                                    <MenuItem
                                        title={translate('workspace.expensifyCard.newCard')}
                                        icon={Expensicons.Plus}
                                        onPress={handleIssueNewCard}
                                    />
                                </>
                            )}
                        </View>
                    </View>
                </ScrollView>
            </ScreenWrapper>
        </AccessOrNotFoundWrapper>
    );
}

WorkspaceMemberDetailsPage.displayName = 'WorkspaceMemberDetailsPage';

export default withPolicyAndFullscreenLoading(WorkspaceMemberDetailsPage);
