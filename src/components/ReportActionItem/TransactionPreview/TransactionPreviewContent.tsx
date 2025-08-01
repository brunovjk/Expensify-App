import lodashSortBy from 'lodash/sortBy';
import truncate from 'lodash/truncate';
import React, {useMemo} from 'react';
import {View} from 'react-native';
import Button from '@components/Button';
import Icon from '@components/Icon';
import {DotIndicator, Folder, Tag} from '@components/Icon/Expensicons';
import MultipleAvatars from '@components/MultipleAvatars';
import OfflineWithFeedback from '@components/OfflineWithFeedback';
import ReportActionItemImages from '@components/ReportActionItem/ReportActionItemImages';
import UserInfoCellsWithArrow from '@components/SelectionList/Search/UserInfoCellsWithArrow';
import Text from '@components/Text';
import TransactionPreviewSkeletonView from '@components/TransactionPreviewSkeletonView';
import useLocalize from '@hooks/useLocalize';
import useOnyx from '@hooks/useOnyx';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import {convertToDisplayString} from '@libs/CurrencyUtils';
import getNonEmptyStringOnyxID from '@libs/getNonEmptyStringOnyxID';
import {calculateAmount} from '@libs/IOUUtils';
import {getAvatarsForAccountIDs} from '@libs/OptionsListUtils';
import Parser from '@libs/Parser';
import {getCommaSeparatedTagNameWithSanitizedColons} from '@libs/PolicyUtils';
import {getThumbnailAndImageURIs} from '@libs/ReceiptUtils';
import {getOriginalMessage, isMoneyRequestAction} from '@libs/ReportActionsUtils';
import type {TransactionDetails} from '@libs/ReportUtils';
import {canEditMoneyRequest, getTransactionDetails, getWorkspaceIcon, isPolicyExpenseChat, isReportApproved, isSettled} from '@libs/ReportUtils';
import StringUtils from '@libs/StringUtils';
import type {TranslationPathOrText} from '@libs/TransactionPreviewUtils';
import {createTransactionPreviewConditionals, getIOUPayerAndReceiver, getTransactionPreviewTextAndTranslationPaths} from '@libs/TransactionPreviewUtils';
import {isCardTransaction as isCardTransactionUtils, isScanning} from '@libs/TransactionUtils';
import ViolationsUtils from '@libs/Violations/ViolationsUtils';
import variables from '@styles/variables';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {TransactionPreviewContentProps} from './types';

function TransactionPreviewContent({
    action,
    isWhisper,
    isHovered,
    chatReport,
    personalDetails,
    report,
    transaction,
    violations,
    transactionRawAmount,
    offlineWithFeedbackOnClose,
    containerStyles,
    transactionPreviewWidth,
    isBillSplit,
    areThereDuplicates,
    sessionAccountID,
    walletTermsErrors,
    reportPreviewAction,
    shouldHideOnDelete = true,
    shouldShowPayerAndReceiver,
    navigateToReviewFields,
    isReviewDuplicateTransactionPage = false,
}: TransactionPreviewContentProps) {
    const theme = useTheme();
    const styles = useThemeStyles();
    const {translate} = useLocalize();

    const [policy] = useOnyx(`${ONYXKEYS.COLLECTION.POLICY}${report?.policyID}`, {canBeMissing: true});
    const transactionDetails = useMemo<Partial<TransactionDetails>>(() => getTransactionDetails(transaction, undefined, policy) ?? {}, [transaction, policy]);
    const {amount, comment: requestComment, merchant, tag, category, currency: requestCurrency} = transactionDetails;

    const managerID = report?.managerID ?? reportPreviewAction?.childManagerAccountID ?? CONST.DEFAULT_NUMBER_ID;
    const ownerAccountID = report?.ownerAccountID ?? reportPreviewAction?.childOwnerAccountID ?? CONST.DEFAULT_NUMBER_ID;
    const isReportAPolicyExpenseChat = isPolicyExpenseChat(chatReport);
    const [reportActions] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${getNonEmptyStringOnyxID(report?.reportID)}`, {canBeMissing: true});

    const transactionPreviewCommonArguments = useMemo(
        () => ({
            iouReport: report,
            transaction,
            action,
            isBillSplit,
            violations,
            transactionDetails,
        }),
        [action, report, isBillSplit, transaction, transactionDetails, violations],
    );

    const conditionals = useMemo(
        () =>
            createTransactionPreviewConditionals({
                ...transactionPreviewCommonArguments,
                areThereDuplicates,
                isReportAPolicyExpenseChat,
            }),
        [areThereDuplicates, transactionPreviewCommonArguments, isReportAPolicyExpenseChat],
    );

    const {shouldShowRBR, shouldShowMerchant, shouldShowSplitShare, shouldShowTag, shouldShowCategory, shouldShowSkeleton, shouldShowDescription} = conditionals;

    const firstViolation = violations.at(0);
    const isIOUActionType = isMoneyRequestAction(action);
    const canEdit = isIOUActionType && canEditMoneyRequest(action, transaction);
    const violationMessage = firstViolation ? ViolationsUtils.getViolationTranslation(firstViolation, translate, canEdit) : undefined;

    const previewText = useMemo(
        () =>
            getTransactionPreviewTextAndTranslationPaths({
                ...transactionPreviewCommonArguments,
                shouldShowRBR,
                violationMessage,
                reportActions,
            }),
        [transactionPreviewCommonArguments, shouldShowRBR, violationMessage, reportActions],
    );
    const getTranslatedText = (item: TranslationPathOrText) => (item.translationPath ? translate(item.translationPath) : (item.text ?? ''));

    const previewHeaderText = previewText.previewHeaderText.reduce((text, currentKey) => {
        return `${text}${getTranslatedText(currentKey)}`;
    }, '');

    const RBRMessage = getTranslatedText(previewText.RBRMessage);
    const displayAmountText = getTranslatedText(previewText.displayAmountText);
    const displayDeleteAmountText = getTranslatedText(previewText.displayDeleteAmountText);

    const isDeleted = action?.pendingAction === CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE || transaction?.pendingAction === CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE;
    const shouldShowCategoryOrTag = shouldShowCategory || shouldShowTag;
    const shouldShowMerchantOrDescription = shouldShowDescription || shouldShowMerchant;

    const description = truncate(StringUtils.lineBreaksToSpaces(Parser.htmlToText(requestComment ?? '')), {length: CONST.REQUEST_PREVIEW.MAX_LENGTH});
    const requestMerchant = truncate(merchant, {length: CONST.REQUEST_PREVIEW.MAX_LENGTH});
    const isApproved = isReportApproved({report});
    const isIOUSettled = isSettled(report?.reportID);
    const isSettlementOrApprovalPartial = !!report?.pendingFields?.partial;
    const isTransactionScanning = isScanning(transaction);
    const displayAmount = isDeleted ? displayDeleteAmountText : displayAmountText;
    const receiptImages = [{...getThumbnailAndImageURIs(transaction), transaction}];
    const merchantOrDescription = shouldShowMerchant ? requestMerchant : description || '';
    const participantAccountIDs = isMoneyRequestAction(action) && isBillSplit ? (getOriginalMessage(action)?.participantAccountIDs ?? []) : [managerID, ownerAccountID];
    const participantAvatars = getAvatarsForAccountIDs(participantAccountIDs, personalDetails ?? {});
    const sortedParticipantAvatars = lodashSortBy(participantAvatars, (avatar) => avatar.id);
    const isCardTransaction = isCardTransactionUtils(transaction);
    if (isReportAPolicyExpenseChat && isBillSplit) {
        sortedParticipantAvatars.push(getWorkspaceIcon(chatReport));
    }

    // Compute the from/to data only for IOU reports
    const {from, to} = useMemo(() => {
        if (!shouldShowPayerAndReceiver) {
            return {
                from: undefined,
                to: undefined,
            };
        }

        // For IOU or Split, we want the unprocessed amount because it is important whether the amount was positive or negative
        const payerAndReceiver = getIOUPayerAndReceiver(managerID, ownerAccountID, personalDetails, transactionRawAmount);

        return {
            from: payerAndReceiver.from,
            to: payerAndReceiver.to,
        };
    }, [managerID, ownerAccountID, personalDetails, shouldShowPayerAndReceiver, transactionRawAmount]);

    const shouldShowIOUHeader = !!from && !!to;

    // If available, retrieve the split share from the splits object of the transaction, if not, display an even share.
    const actorAccountID = action?.actorAccountID;
    const splitShare = useMemo(() => {
        if (!shouldShowSplitShare) {
            return 0;
        }

        const splitAmount = transaction?.comment?.splits?.find((split) => split.accountID === sessionAccountID)?.amount;
        if (splitAmount !== undefined) {
            return splitAmount;
        }

        let originalParticipantCount = participantAccountIDs.length;

        if (isBillSplit) {
            // Try to get the participant count from transaction splits data
            const transactionSplitsCount = transaction?.comment?.splits?.length;
            if (transactionSplitsCount && transactionSplitsCount > 0) {
                originalParticipantCount = transactionSplitsCount;
            } else if (isMoneyRequestAction(action)) {
                originalParticipantCount = getOriginalMessage(action)?.participantAccountIDs?.length ?? participantAccountIDs.length;
            }
        }

        return calculateAmount(isReportAPolicyExpenseChat ? 1 : originalParticipantCount - 1, amount ?? 0, requestCurrency ?? '', actorAccountID === sessionAccountID);
    }, [
        shouldShowSplitShare,
        isReportAPolicyExpenseChat,
        participantAccountIDs.length,
        transaction?.comment?.splits,
        amount,
        requestCurrency,
        sessionAccountID,
        isBillSplit,
        action,
        actorAccountID,
    ]);

    const shouldWrapDisplayAmount = !(isBillSplit || shouldShowMerchantOrDescription || isTransactionScanning);
    const previewTextViewGap = (shouldShowCategoryOrTag || !shouldWrapDisplayAmount) && styles.gap2;
    const previewTextMargin = shouldShowIOUHeader && shouldShowMerchantOrDescription && !isBillSplit && !shouldShowCategoryOrTag && styles.mbn1;

    const transactionWrapperStyles = [styles.border, styles.moneyRequestPreviewBox, (isIOUSettled || isApproved) && isSettlementOrApprovalPartial && styles.offlineFeedback.pending];

    return (
        <View style={[transactionWrapperStyles, containerStyles]}>
            <OfflineWithFeedback
                errors={walletTermsErrors}
                onClose={() => offlineWithFeedbackOnClose}
                errorRowStyles={[styles.mbn1]}
                needsOffscreenAlphaCompositing
                pendingAction={action?.pendingAction}
                shouldDisableStrikeThrough={isDeleted}
                shouldDisableOpacity={isDeleted}
                shouldHideOnDelete={shouldHideOnDelete}
            >
                <View style={[(isTransactionScanning || isWhisper) && [styles.reportPreviewBoxHoverBorder, styles.reportContainerBorderRadius]]}>
                    <ReportActionItemImages
                        images={receiptImages}
                        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
                        isHovered={isHovered || isTransactionScanning}
                        size={1}
                        shouldUseAspectRatio
                    />
                    {shouldShowSkeleton ? (
                        <TransactionPreviewSkeletonView transactionPreviewWidth={transactionPreviewWidth} />
                    ) : (
                        <View style={[styles.expenseAndReportPreviewBoxBody, styles.mtn1]}>
                            <View style={styles.gap3}>
                                {shouldShowIOUHeader && (
                                    <UserInfoCellsWithArrow
                                        shouldShowToRecipient
                                        participantFrom={from}
                                        participantFromDisplayName={from.displayName ?? from.login ?? translate('common.hidden')}
                                        participantToDisplayName={to.displayName ?? to.login ?? translate('common.hidden')}
                                        participantTo={to}
                                        avatarSize="mid-subscript"
                                        infoCellsTextStyle={{...styles.textMicroBold, lineHeight: 14}}
                                        infoCellsAvatarStyle={styles.pr1}
                                        style={[styles.flex1, styles.dFlex, styles.alignItemsCenter, styles.gap2, styles.flexRow]}
                                    />
                                )}
                                <View style={previewTextViewGap}>
                                    <View style={[styles.flexRow, styles.alignItemsCenter]}>
                                        <Text style={[isDeleted && styles.lineThrough, styles.textLabelSupporting, styles.flex1, styles.lh16, previewTextMargin]}>{previewHeaderText}</Text>
                                        {isBillSplit && (
                                            <View style={styles.moneyRequestPreviewBoxAvatar}>
                                                <MultipleAvatars
                                                    icons={sortedParticipantAvatars}
                                                    shouldStackHorizontally
                                                    size="subscript"
                                                    shouldUseCardBackground
                                                />
                                            </View>
                                        )}
                                        {shouldWrapDisplayAmount && (
                                            <Text
                                                fontSize={variables.fontSizeNormal}
                                                style={[isDeleted && styles.lineThrough, styles.flexShrink0]}
                                                numberOfLines={1}
                                            >
                                                {displayAmount}
                                            </Text>
                                        )}
                                    </View>
                                    <View>
                                        <View style={[styles.flexRow]}>
                                            <View
                                                style={[
                                                    styles.flex1,
                                                    styles.flexRow,
                                                    styles.alignItemsCenter,
                                                    isBillSplit && !shouldShowMerchantOrDescription ? styles.justifyContentEnd : styles.justifyContentBetween,
                                                    styles.gap2,
                                                ]}
                                            >
                                                {shouldShowMerchantOrDescription && (
                                                    <Text
                                                        fontSize={variables.fontSizeNormal}
                                                        style={[isDeleted && styles.lineThrough, styles.flexShrink1]}
                                                        numberOfLines={1}
                                                    >
                                                        {merchantOrDescription}
                                                    </Text>
                                                )}
                                                {!shouldWrapDisplayAmount && (
                                                    <Text
                                                        fontSize={variables.fontSizeNormal}
                                                        style={[isDeleted && styles.lineThrough, styles.flexShrink0]}
                                                        numberOfLines={1}
                                                    >
                                                        {displayAmount}
                                                    </Text>
                                                )}
                                            </View>
                                        </View>
                                        <View style={[styles.flexRow, styles.justifyContentEnd]}>
                                            {!!splitShare && (
                                                <Text style={[isDeleted && styles.lineThrough, styles.textLabel, styles.colorMuted, styles.amountSplitPadding]}>
                                                    {translate('iou.yourSplit', {amount: convertToDisplayString(splitShare, requestCurrency)})}
                                                </Text>
                                            )}
                                        </View>
                                    </View>
                                    {shouldShowCategoryOrTag && (
                                        <View style={[styles.flexRow, styles.alignItemsCenter]}>
                                            {shouldShowCategory && (
                                                <View
                                                    style={[
                                                        styles.flexRow,
                                                        styles.alignItemsCenter,
                                                        styles.gap1,
                                                        shouldShowTag && styles.mw50,
                                                        shouldShowTag && styles.pr1,
                                                        styles.flexShrink1,
                                                    ]}
                                                >
                                                    <Icon
                                                        src={Folder}
                                                        height={variables.iconSizeExtraSmall}
                                                        width={variables.iconSizeExtraSmall}
                                                        fill={theme.icon}
                                                    />
                                                    <Text
                                                        numberOfLines={1}
                                                        style={[isDeleted && styles.lineThrough, styles.textMicroSupporting, styles.pre, styles.flexShrink1]}
                                                    >
                                                        {category}
                                                    </Text>
                                                </View>
                                            )}
                                            {shouldShowTag && !!tag && (
                                                <View style={[styles.flex1, styles.flexRow, styles.alignItemsCenter, styles.gap1, category && styles.pl1]}>
                                                    <Icon
                                                        src={Tag}
                                                        height={variables.iconSizeExtraSmall}
                                                        width={variables.iconSizeExtraSmall}
                                                        fill={theme.icon}
                                                    />
                                                    <Text
                                                        numberOfLines={1}
                                                        style={[isDeleted && styles.lineThrough, styles.textMicroSupporting, styles.pre, styles.flexShrink1]}
                                                    >
                                                        {getCommaSeparatedTagNameWithSanitizedColons(tag)}
                                                    </Text>
                                                </View>
                                            )}
                                        </View>
                                    )}
                                </View>
                                {!isIOUSettled && shouldShowRBR && (
                                    <View style={[styles.flexRow, styles.alignItemsCenter, styles.gap1]}>
                                        <Icon
                                            src={DotIndicator}
                                            fill={theme.danger}
                                            height={variables.iconSizeExtraSmall}
                                            width={variables.iconSizeExtraSmall}
                                        />
                                        <Text
                                            numberOfLines={1}
                                            style={[isDeleted && styles.lineThrough, styles.textMicroSupporting, styles.pre, styles.flexShrink1, {color: theme.danger}]}
                                        >
                                            {RBRMessage}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        </View>
                    )}
                    {isReviewDuplicateTransactionPage && !isIOUSettled && !isApproved && !isCardTransaction && areThereDuplicates && (
                        <Button
                            text={translate('violations.keepThisOne')}
                            success
                            style={[styles.ph4, styles.pb4]}
                            onPress={navigateToReviewFields}
                        />
                    )}
                </View>
            </OfflineWithFeedback>
        </View>
    );
}

TransactionPreviewContent.displayName = 'TransactionPreviewContent';

export default TransactionPreviewContent;
