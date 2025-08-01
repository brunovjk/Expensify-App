import {useFocusEffect} from '@react-navigation/native';
import React, {useCallback, useContext, useEffect, useRef, useState} from 'react';
import type {ImageStyle, StyleProp} from 'react-native';
import {Image, StyleSheet, View} from 'react-native';
import Avatar from '@components/Avatar';
import AvatarWithImagePicker from '@components/AvatarWithImagePicker';
import ButtonWithDropdownMenu from '@components/ButtonWithDropdownMenu';
import type {DropdownOption} from '@components/ButtonWithDropdownMenu/types';
import ConfirmModal from '@components/ConfirmModal';
import {FallbackWorkspaceAvatar, ImageCropSquareMask, QrCode, Trashcan, UserPlus} from '@components/Icon/Expensicons';
import {Building} from '@components/Icon/Illustrations';
import {LockedAccountContext} from '@components/LockedAccountModalProvider';
import MenuItemWithTopDescription from '@components/MenuItemWithTopDescription';
import OfflineWithFeedback from '@components/OfflineWithFeedback';
import Section from '@components/Section';
import useCardFeeds from '@hooks/useCardFeeds';
import useLocalize from '@hooks/useLocalize';
import useNetwork from '@hooks/useNetwork';
import useOnyx from '@hooks/useOnyx';
import usePayAndDowngrade from '@hooks/usePayAndDowngrade';
import useResponsiveLayout from '@hooks/useResponsiveLayout';
import useThemeIllustrations from '@hooks/useThemeIllustrations';
import useThemeStyles from '@hooks/useThemeStyles';
import {clearInviteDraft} from '@libs/actions/Policy/Member';
import {
    calculateBillNewDot,
    clearAvatarErrors,
    clearPolicyErrorField,
    deleteWorkspace,
    deleteWorkspaceAvatar,
    openPolicyProfilePage,
    setIsComingFromGlobalReimbursementsFlow,
    updateWorkspaceAvatar,
} from '@libs/actions/Policy/Policy';
import {filterInactiveCards} from '@libs/CardUtils';
import {getLatestErrorField} from '@libs/ErrorUtils';
import Navigation from '@libs/Navigation/Navigation';
import type {PlatformStackScreenProps} from '@libs/Navigation/PlatformStackNavigation/types';
import type {WorkspaceSplitNavigatorParamList} from '@libs/Navigation/types';
import {getUserFriendlyWorkspaceType, goBackFromInvalidPolicy, isPolicyAdmin as isPolicyAdminPolicyUtils, isPolicyOwner} from '@libs/PolicyUtils';
import {getDefaultWorkspaceAvatar} from '@libs/ReportUtils';
import StringUtils from '@libs/StringUtils';
import {shouldCalculateBillNewDot} from '@libs/SubscriptionUtils';
import {getFullSizeAvatar} from '@libs/UserUtils';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import type SCREENS from '@src/SCREENS';
import type {CurrencyList} from '@src/types/onyx';
import {getEmptyObject, isEmptyObject} from '@src/types/utils/EmptyObject';
import type {WithPolicyProps} from './withPolicy';
import withPolicy from './withPolicy';
import WorkspacePageWithSections from './WorkspacePageWithSections';

type WorkspaceOverviewPageProps = WithPolicyProps & PlatformStackScreenProps<WorkspaceSplitNavigatorParamList, typeof SCREENS.WORKSPACE.PROFILE>;

function WorkspaceOverviewPage({policyDraft, policy: policyProp, route}: WorkspaceOverviewPageProps) {
    const styles = useThemeStyles();
    const {translate} = useLocalize();
    const {shouldUseNarrowLayout} = useResponsiveLayout();
    const illustrations = useThemeIllustrations();

    const backTo = route.params.backTo;
    const [currencyList = getEmptyObject<CurrencyList>()] = useOnyx(ONYXKEYS.CURRENCY_LIST, {canBeMissing: true});
    const [currentUserAccountID = -1] = useOnyx(ONYXKEYS.SESSION, {
        selector: (session) => session?.accountID,
        canBeMissing: true,
    });
    const [isComingFromGlobalReimbursementsFlow] = useOnyx(ONYXKEYS.IS_COMING_FROM_GLOBAL_REIMBURSEMENTS_FLOW, {canBeMissing: true});

    // When we create a new workspace, the policy prop will be empty on the first render. Therefore, we have to use policyDraft until policy has been set in Onyx.
    const policy = policyDraft?.id ? policyDraft : policyProp;
    const isPolicyAdmin = isPolicyAdminPolicyUtils(policy);
    const outputCurrency = policy?.outputCurrency ?? '';
    const currencySymbol = currencyList?.[outputCurrency]?.symbol ?? '';
    const formattedCurrency = !isEmptyObject(policy) && !isEmptyObject(currencyList) ? `${outputCurrency} - ${currencySymbol}` : '';

    // We need this to update translation for deleting a workspace when it has third party card feeds or expensify card assigned.
    const workspaceAccountID = policy?.workspaceAccountID ?? CONST.DEFAULT_NUMBER_ID;
    const [cardFeeds] = useCardFeeds(policy?.id);
    const [cardsList] = useOnyx(`${ONYXKEYS.COLLECTION.WORKSPACE_CARDS_LIST}${workspaceAccountID}_${CONST.EXPENSIFY_CARD.BANK}`, {
        selector: filterInactiveCards,
        canBeMissing: true,
    });
    const hasCardFeedOrExpensifyCard =
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        !isEmptyObject(cardFeeds) || !isEmptyObject(cardsList) || ((policy?.areExpensifyCardsEnabled || policy?.areCompanyCardsEnabled) && policy?.workspaceAccountID);

    const [street1, street2] = (policy?.address?.addressStreet ?? '').split('\n');
    const formattedAddress =
        !isEmptyObject(policy) && !isEmptyObject(policy.address)
            ? `${street1?.trim()}, ${street2 ? `${street2.trim()}, ` : ''}${policy.address.city}, ${policy.address.state} ${policy.address.zipCode ?? ''}`
            : '';

    const onPressCurrency = useCallback(() => {
        if (!policy?.id) {
            return;
        }
        Navigation.navigate(ROUTES.WORKSPACE_OVERVIEW_CURRENCY.getRoute(policy.id));
    }, [policy?.id]);
    const onPressAddress = useCallback(() => {
        if (!policy?.id) {
            return;
        }
        Navigation.navigate(ROUTES.WORKSPACE_OVERVIEW_ADDRESS.getRoute(policy.id));
    }, [policy?.id]);
    const onPressName = useCallback(() => {
        if (!policy?.id) {
            return;
        }
        Navigation.navigate(ROUTES.WORKSPACE_OVERVIEW_NAME.getRoute(policy.id));
    }, [policy?.id]);
    const onPressDescription = useCallback(() => {
        if (!policy?.id) {
            return;
        }
        Navigation.navigate(ROUTES.WORKSPACE_OVERVIEW_DESCRIPTION.getRoute(policy.id));
    }, [policy?.id]);
    const onPressShare = useCallback(() => {
        if (!policy?.id) {
            return;
        }
        Navigation.navigate(ROUTES.WORKSPACE_OVERVIEW_SHARE.getRoute(policy.id));
    }, [policy?.id]);
    const onPressPlanType = useCallback(() => {
        if (!policy?.id) {
            return;
        }
        Navigation.navigate(ROUTES.WORKSPACE_OVERVIEW_PLAN.getRoute(policy.id));
    }, [policy?.id]);
    const policyName = policy?.name ?? '';
    const policyDescription = policy?.description ?? translate('workspace.common.defaultDescription');
    const policyCurrency = policy?.outputCurrency ?? '';
    const readOnly = !isPolicyAdminPolicyUtils(policy);
    const isOwner = isPolicyOwner(policy, currentUserAccountID);
    const imageStyle: StyleProp<ImageStyle> = shouldUseNarrowLayout ? [styles.mhv12, styles.mhn5, styles.mbn5] : [styles.mhv8, styles.mhn8, styles.mbn5];
    const shouldShowAddress = !readOnly || !!formattedAddress;
    const {isAccountLocked, showLockedAccountModal} = useContext(LockedAccountContext);

    const fetchPolicyData = useCallback(() => {
        if (policyDraft?.id) {
            return;
        }
        openPolicyProfilePage(route.params.policyID);
    }, [policyDraft?.id, route.params.policyID]);

    useNetwork({onReconnect: fetchPolicyData});

    // We have the same focus effect in the WorkspaceInitialPage, this way we can get the policy data in narrow
    // as well as in the wide layout when looking at policy settings.
    useFocusEffect(
        useCallback(() => {
            fetchPolicyData();
        }, [fetchPolicyData]),
    );

    const DefaultAvatar = useCallback(
        () => (
            <Avatar
                containerStyles={styles.avatarXLarge}
                imageStyles={[styles.avatarXLarge, styles.alignSelfCenter]}
                // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- nullish coalescing cannot be used if left side can be empty string
                source={policy?.avatarURL || getDefaultWorkspaceAvatar(policyName)}
                fallbackIcon={FallbackWorkspaceAvatar}
                size={CONST.AVATAR_SIZE.X_LARGE}
                name={policyName}
                avatarID={policy?.id}
                type={CONST.ICON_TYPE_WORKSPACE}
            />
        ),
        [policy?.avatarURL, policy?.id, policyName, styles.alignSelfCenter, styles.avatarXLarge],
    );

    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

    const {setIsDeletingPaidWorkspace, isLoadingBill}: {setIsDeletingPaidWorkspace: (value: boolean) => void; isLoadingBill: boolean | undefined} = usePayAndDowngrade(setIsDeleteModalOpen);

    const dropdownMenuRef = useRef<{setIsMenuVisible: (visible: boolean) => void} | null>(null);

    const confirmDeleteAndHideModal = useCallback(() => {
        if (!policy?.id || !policyName) {
            return;
        }

        deleteWorkspace(policy.id, policyName);
        setIsDeleteModalOpen(false);
        goBackFromInvalidPolicy();
    }, [policy?.id, policyName]);

    useEffect(() => {
        if (isLoadingBill) {
            return;
        }
        dropdownMenuRef.current?.setIsMenuVisible(false);
    }, [isLoadingBill]);

    const onDeleteWorkspace = useCallback(() => {
        if (shouldCalculateBillNewDot()) {
            setIsDeletingPaidWorkspace(true);
            calculateBillNewDot();
            return;
        }

        setIsDeleteModalOpen(true);
    }, [setIsDeletingPaidWorkspace]);

    const handleBackButtonPress = () => {
        if (isComingFromGlobalReimbursementsFlow) {
            setIsComingFromGlobalReimbursementsFlow(false);
            Navigation.goBack();
        }

        if (backTo) {
            Navigation.goBack(backTo);
            return;
        }

        Navigation.popToSidebar();
    };

    const getHeaderButtons = () => {
        if (readOnly) {
            return null;
        }
        const secondaryActions: Array<DropdownOption<string>> = [];
        if (isPolicyAdmin) {
            secondaryActions.push({
                value: 'invite',
                text: translate('common.invite'),
                icon: UserPlus,
                onSelected: () => {
                    if (isAccountLocked) {
                        showLockedAccountModal();
                        return;
                    }
                    clearInviteDraft(route.params.policyID);
                    Navigation.navigate(ROUTES.WORKSPACE_INVITE.getRoute(route.params.policyID, Navigation.getActiveRouteWithoutParams()));
                },
            });
        }
        secondaryActions.push({
            value: 'share',
            text: translate('common.share'),
            icon: QrCode,
            onSelected: isAccountLocked ? showLockedAccountModal : onPressShare,
        });
        if (isOwner) {
            secondaryActions.push({
                value: 'delete',
                text: translate('common.delete'),
                icon: Trashcan,
                onSelected: onDeleteWorkspace,
                disabled: isLoadingBill,
                shouldShowLoadingSpinnerIcon: isLoadingBill,
                shouldCloseModalOnSelect: !shouldCalculateBillNewDot(),
            });
        }
        return (
            <View style={[!shouldUseNarrowLayout && styles.flexRow, !shouldUseNarrowLayout && styles.gap2]}>
                <ButtonWithDropdownMenu
                    ref={dropdownMenuRef}
                    success={false}
                    onPress={() => {}}
                    shouldAlwaysShowDropdownMenu
                    customText={translate('common.more')}
                    options={secondaryActions}
                    isSplitButton={false}
                    wrapperStyle={styles.flexGrow1}
                />
            </View>
        );
    };

    return (
        <WorkspacePageWithSections
            headerText={translate('workspace.common.profile')}
            route={route}
            // When we create a new workspaces, the policy prop will not be set on the first render. Therefore, we have to delay rendering until it has been set in Onyx.
            shouldShowLoading={policy === undefined}
            shouldUseScrollView
            shouldShowOfflineIndicatorInWideScreen
            shouldShowNonAdmin
            icon={Building}
            shouldShowNotFoundPage={policy === undefined}
            onBackButtonPress={handleBackButtonPress}
            addBottomSafeAreaPadding
            headerContent={!shouldUseNarrowLayout && getHeaderButtons()}
        >
            {(hasVBA?: boolean) => (
                <View style={[styles.flex1, styles.mt3, shouldUseNarrowLayout ? styles.workspaceSectionMobile : styles.workspaceSection]}>
                    {shouldUseNarrowLayout && <View style={[styles.pl5, styles.pr5, styles.pb5]}>{getHeaderButtons()}</View>}
                    <Section
                        isCentralPane
                        title=""
                    >
                        <Image
                            style={StyleSheet.flatten([styles.wAuto, styles.h68, imageStyle])}
                            source={illustrations.WorkspaceProfile}
                            resizeMode="cover"
                        />
                        <AvatarWithImagePicker
                            onViewPhotoPress={() => {
                                if (!policy?.id) {
                                    return;
                                }
                                Navigation.navigate(ROUTES.WORKSPACE_AVATAR.getRoute(policy.id));
                            }}
                            source={policy?.avatarURL ?? ''}
                            avatarID={policy?.id}
                            size={CONST.AVATAR_SIZE.X_LARGE}
                            avatarStyle={styles.avatarXLarge}
                            enablePreview
                            DefaultAvatar={DefaultAvatar}
                            type={CONST.ICON_TYPE_WORKSPACE}
                            fallbackIcon={FallbackWorkspaceAvatar}
                            style={[
                                (policy?.errorFields?.avatarURL ?? shouldUseNarrowLayout) ? styles.mb1 : styles.mb3,
                                shouldUseNarrowLayout ? styles.mtn17 : styles.mtn20,
                                styles.alignItemsStart,
                                styles.sectionMenuItemTopDescription,
                            ]}
                            editIconStyle={styles.smallEditIconWorkspace}
                            isUsingDefaultAvatar={!policy?.avatarURL}
                            onImageSelected={(file) => {
                                if (!policy?.id) {
                                    return;
                                }
                                updateWorkspaceAvatar(policy.id, file as File);
                            }}
                            onImageRemoved={() => {
                                if (!policy?.id) {
                                    return;
                                }
                                deleteWorkspaceAvatar(policy.id);
                            }}
                            editorMaskImage={ImageCropSquareMask}
                            pendingAction={policy?.pendingFields?.avatarURL}
                            errors={policy?.errorFields?.avatarURL}
                            onErrorClose={() => {
                                if (!policy?.id) {
                                    return;
                                }
                                clearAvatarErrors(policy.id);
                            }}
                            previewSource={getFullSizeAvatar(policy?.avatarURL ?? '')}
                            headerTitle={translate('workspace.common.workspaceAvatar')}
                            originalFileName={policy?.originalFileName}
                            disabled={readOnly}
                            disabledStyle={styles.cursorDefault}
                            errorRowStyles={styles.mt3}
                        />
                        <OfflineWithFeedback pendingAction={policy?.pendingFields?.name}>
                            <MenuItemWithTopDescription
                                title={policyName}
                                titleStyle={styles.workspaceTitleStyle}
                                description={translate('workspace.common.workspaceName')}
                                shouldShowRightIcon={!readOnly}
                                interactive={!readOnly}
                                wrapperStyle={[styles.sectionMenuItemTopDescription, shouldUseNarrowLayout ? styles.mt3 : {}]}
                                onPress={onPressName}
                                shouldBreakWord
                                numberOfLinesTitle={0}
                            />
                        </OfflineWithFeedback>
                        {(!StringUtils.isEmptyString(policy?.description ?? '') || !readOnly) && (
                            <OfflineWithFeedback
                                pendingAction={policy?.pendingFields?.description}
                                errors={getLatestErrorField(policy ?? {}, CONST.POLICY.COLLECTION_KEYS.DESCRIPTION)}
                                onClose={() => {
                                    if (!policy?.id) {
                                        return;
                                    }
                                    clearPolicyErrorField(policy.id, CONST.POLICY.COLLECTION_KEYS.DESCRIPTION);
                                }}
                            >
                                <MenuItemWithTopDescription
                                    title={policyDescription}
                                    description={translate('workspace.editor.descriptionInputLabel')}
                                    shouldShowRightIcon={!readOnly}
                                    interactive={!readOnly}
                                    wrapperStyle={styles.sectionMenuItemTopDescription}
                                    onPress={onPressDescription}
                                    shouldRenderAsHTML
                                />
                            </OfflineWithFeedback>
                        )}
                        <OfflineWithFeedback
                            pendingAction={policy?.pendingFields?.outputCurrency}
                            errors={getLatestErrorField(policy ?? {}, CONST.POLICY.COLLECTION_KEYS.GENERAL_SETTINGS)}
                            onClose={() => {
                                if (!policy?.id) {
                                    return;
                                }
                                clearPolicyErrorField(policy.id, CONST.POLICY.COLLECTION_KEYS.GENERAL_SETTINGS);
                            }}
                            errorRowStyles={[styles.mt2]}
                        >
                            <View>
                                <MenuItemWithTopDescription
                                    title={formattedCurrency}
                                    description={translate('workspace.editor.currencyInputLabel')}
                                    shouldShowRightIcon={hasVBA ? false : !readOnly}
                                    interactive={hasVBA ? false : !readOnly}
                                    wrapperStyle={styles.sectionMenuItemTopDescription}
                                    onPress={onPressCurrency}
                                    hintText={
                                        hasVBA ? translate('workspace.editor.currencyInputDisabledText', {currency: policyCurrency}) : translate('workspace.editor.currencyInputHelpText')
                                    }
                                />
                            </View>
                        </OfflineWithFeedback>
                        {shouldShowAddress && (
                            <OfflineWithFeedback pendingAction={policy?.pendingFields?.address}>
                                <View>
                                    <MenuItemWithTopDescription
                                        title={formattedAddress}
                                        description={translate('common.companyAddress')}
                                        shouldShowRightIcon={!readOnly}
                                        interactive={!readOnly}
                                        wrapperStyle={styles.sectionMenuItemTopDescription}
                                        onPress={onPressAddress}
                                        copyValue={readOnly ? formattedAddress : undefined}
                                    />
                                </View>
                            </OfflineWithFeedback>
                        )}

                        {!readOnly && !!policy?.type && (
                            <OfflineWithFeedback pendingAction={policy?.pendingFields?.type}>
                                <View>
                                    <MenuItemWithTopDescription
                                        title={getUserFriendlyWorkspaceType(policy.type)}
                                        description={translate('workspace.common.planType')}
                                        shouldShowRightIcon
                                        wrapperStyle={styles.sectionMenuItemTopDescription}
                                        onPress={onPressPlanType}
                                    />
                                </View>
                            </OfflineWithFeedback>
                        )}
                    </Section>
                    <ConfirmModal
                        title={translate('workspace.common.delete')}
                        isVisible={isDeleteModalOpen}
                        onConfirm={confirmDeleteAndHideModal}
                        onCancel={() => setIsDeleteModalOpen(false)}
                        prompt={hasCardFeedOrExpensifyCard ? translate('workspace.common.deleteWithCardsConfirmation') : translate('workspace.common.deleteConfirmation')}
                        confirmText={translate('common.delete')}
                        cancelText={translate('common.cancel')}
                        danger
                    />
                </View>
            )}
        </WorkspacePageWithSections>
    );
}

WorkspaceOverviewPage.displayName = 'WorkspaceOverviewPage';

export default withPolicy(WorkspaceOverviewPage);
