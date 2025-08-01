import {FlashList} from '@shopify/flash-list';
import lodashSortBy from 'lodash/sortBy';
import type {ReactElement, Ref} from 'react';
import React, {useCallback, useMemo} from 'react';
import type {GestureResponderEvent, StyleProp, ViewStyle} from 'react-native';
import {View} from 'react-native';
import type {SvgProps} from 'react-native-svg/lib/typescript/ReactNativeSVG';
import type {ValueOf} from 'type-fest';
import type {RenderSuggestionMenuItemProps} from '@components/AutoCompleteSuggestions/types';
import Button from '@components/Button';
import FormAlertWrapper from '@components/FormAlertWrapper';
import * as Expensicons from '@components/Icon/Expensicons';
import MenuItem from '@components/MenuItem';
import OfflineWithFeedback from '@components/OfflineWithFeedback';
import Text from '@components/Text';
import useLocalize from '@hooks/useLocalize';
import useNetwork from '@hooks/useNetwork';
import useOnyx from '@hooks/useOnyx';
import type {FormattedSelectedPaymentMethodIcon} from '@hooks/usePaymentMethodState/types';
import useStyleUtils from '@hooks/useStyleUtils';
import useThemeIllustrations from '@hooks/useThemeIllustrations';
import useThemeStyles from '@hooks/useThemeStyles';
import {clearAddPaymentMethodError, clearDeletePaymentMethodError} from '@libs/actions/PaymentMethods';
import {getCardFeedIcon, getPlaidInstitutionIconUrl, isExpensifyCard, lastFourNumbersFromCardName, maskCardNumber} from '@libs/CardUtils';
import Log from '@libs/Log';
import Navigation from '@libs/Navigation/Navigation';
import {formatPaymentMethods} from '@libs/PaymentUtils';
import {getDescriptionForPolicyDomainCard} from '@libs/PolicyUtils';
import variables from '@styles/variables';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import type {AccountData, BankAccount, BankAccountList, Card, CardList, CompanyCardFeed} from '@src/types/onyx';
import type {BankIcon} from '@src/types/onyx/Bank';
import type {Errors} from '@src/types/onyx/OnyxCommon';
import type PaymentMethod from '@src/types/onyx/PaymentMethod';
import type {FilterMethodPaymentType} from '@src/types/onyx/WalletTransfer';
import {getEmptyObject, isEmptyObject} from '@src/types/utils/EmptyObject';
import isLoadingOnyxValue from '@src/types/utils/isLoadingOnyxValue';

type PaymentMethodPressHandler = (
    event?: GestureResponderEvent | KeyboardEvent,
    accountType?: string,
    accountData?: AccountData,
    icon?: FormattedSelectedPaymentMethodIcon,
    isDefault?: boolean,
    methodID?: number,
    description?: string,
) => void;

type CardPressHandler = (event?: GestureResponderEvent | KeyboardEvent, cardData?: Card, icon?: FormattedSelectedPaymentMethodIcon, cardID?: number) => void;

type PaymentMethodListProps = {
    /** Type of active/highlighted payment method */
    actionPaymentMethodType?: string;

    /** ID of active/highlighted payment method */
    activePaymentMethodID?: string | number;

    /** ID of selected payment method */
    selectedMethodID?: string | number;

    /** Content for the FlatList header component */
    listHeaderComponent?: ReactElement;

    /** Callback for whenever FlatList component size changes */
    onListContentSizeChange?: () => void;

    /** Should menu items be selectable with a checkbox */
    shouldShowSelectedState?: boolean;

    /** React ref being forwarded to the PaymentMethodList Button */
    buttonRef?: Ref<View>;

    /** List container style */
    style?: StyleProp<ViewStyle>;

    /** List item style */
    listItemStyle?: StyleProp<ViewStyle>;

    /** Type to filter the payment Method list */
    filterType?: FilterMethodPaymentType;

    /** Whether the add bank account button should be shown on the list */
    shouldShowAddBankAccount?: boolean;

    /** Whether the add Payment button be shown on the list */
    shouldShowAddPaymentMethodButton?: boolean;

    /** Whether the add Bank account button be shown on the list */
    shouldShowAddBankAccountButton?: boolean;

    /** Whether the assigned cards should be shown on the list */
    shouldShowAssignedCards?: boolean;

    /** Whether the empty list message should be shown when the list is empty */
    shouldShowEmptyListMessage?: boolean;

    /** Whether the right icon should be shown in PaymentMethodItem */
    shouldShowRightIcon?: boolean;

    /** What to do when a menu item is pressed */
    onPress: PaymentMethodPressHandler | CardPressHandler;

    /** The policy invoice's transfer bank accountID */
    invoiceTransferBankAccountID?: number;

    /** Whether the bank accounts should be displayed in private and business sections */
    shouldShowBankAccountSections?: boolean;
};

type PaymentMethodItem = PaymentMethod & {
    key?: string;
    title?: string;
    description: string;
    onPress?: (e: GestureResponderEvent | KeyboardEvent | undefined) => void;
    isGroupedCardDomain?: boolean;
    canDismissError?: boolean;
    disabled?: boolean;
    shouldShowRightIcon?: boolean;
    interactive?: boolean;
    brickRoadIndicator?: ValueOf<typeof CONST.BRICK_ROAD_INDICATOR_STATUS>;
    errors?: Errors;
    iconRight?: React.FC<SvgProps>;
    isMethodActive?: boolean;
    cardID?: number;
    plaidUrl?: string;
} & BankIcon;

function dismissError(item: PaymentMethodItem) {
    if (item.cardID) {
        clearDeletePaymentMethodError(ONYXKEYS.CARD_LIST, item.cardID);
        return;
    }

    const isBankAccount = item.accountType === CONST.PAYMENT_METHODS.PERSONAL_BANK_ACCOUNT;
    const paymentList = isBankAccount ? ONYXKEYS.BANK_ACCOUNT_LIST : ONYXKEYS.FUND_LIST;
    const paymentID = isBankAccount ? item.accountData?.bankAccountID : item.accountData?.fundID;

    if (!paymentID) {
        Log.info('Unable to clear payment method error: ', undefined, item);
        return;
    }

    if (item.pendingAction === CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE) {
        clearDeletePaymentMethodError(paymentList, paymentID);
        if (!isBankAccount) {
            clearDeletePaymentMethodError(ONYXKEYS.FUND_LIST, paymentID);
        }
    } else {
        clearAddPaymentMethodError(paymentList, paymentID);
        if (!isBankAccount) {
            clearAddPaymentMethodError(ONYXKEYS.FUND_LIST, paymentID);
        }
    }
}

function shouldShowDefaultBadge(filteredPaymentMethods: PaymentMethod[], isDefault = false): boolean {
    if (!isDefault) {
        return false;
    }
    const defaultPaymentMethodCount = filteredPaymentMethods.filter(
        (method) => method.accountType === CONST.PAYMENT_METHODS.PERSONAL_BANK_ACCOUNT || method.accountType === CONST.PAYMENT_METHODS.DEBIT_CARD,
    ).length;
    return defaultPaymentMethodCount > 1;
}

function isPaymentMethodActive(actionPaymentMethodType: string, activePaymentMethodID: string | number, paymentMethod: PaymentMethod) {
    return paymentMethod.accountType === actionPaymentMethodType && paymentMethod.methodID === activePaymentMethodID;
}

function keyExtractor(item: PaymentMethod | string) {
    if (typeof item === 'string') {
        return item;
    }
    return item.key ?? '';
}

function PaymentMethodList({
    actionPaymentMethodType = '',
    activePaymentMethodID = '',
    buttonRef = () => {},
    filterType = '',
    listHeaderComponent,
    onPress,
    shouldShowSelectedState = false,
    shouldShowAddPaymentMethodButton = true,
    shouldShowAddBankAccountButton = false,
    shouldShowAddBankAccount = true,
    shouldShowEmptyListMessage = true,
    shouldShowAssignedCards = false,
    selectedMethodID = '',
    onListContentSizeChange = () => {},
    style = {},
    listItemStyle = {},
    shouldShowRightIcon = true,
    invoiceTransferBankAccountID,
    shouldShowBankAccountSections = false,
}: PaymentMethodListProps) {
    const styles = useThemeStyles();
    const StyleUtils = useStyleUtils();
    const {translate} = useLocalize();
    const {isOffline} = useNetwork();
    const illustrations = useThemeIllustrations();

    const [isUserValidated] = useOnyx(ONYXKEYS.ACCOUNT, {selector: (account) => account?.validated, canBeMissing: true});
    const [bankAccountList = getEmptyObject<BankAccountList>(), bankAccountListResult] = useOnyx(ONYXKEYS.BANK_ACCOUNT_LIST, {canBeMissing: true});
    const [userWallet] = useOnyx(ONYXKEYS.USER_WALLET, {canBeMissing: true});
    const isLoadingBankAccountList = isLoadingOnyxValue(bankAccountListResult);
    const [cardList = getEmptyObject<CardList>(), cardListResult] = useOnyx(ONYXKEYS.CARD_LIST, {canBeMissing: true});
    const isLoadingCardList = isLoadingOnyxValue(cardListResult);
    // Temporarily disabled because P2P debit cards are disabled.
    // const [fundList = getEmptyObject<FundList>()] = useOnyx(ONYXKEYS.FUND_LIST);
    const [isLoadingPaymentMethods = true, isLoadingPaymentMethodsResult] = useOnyx(ONYXKEYS.IS_LOADING_PAYMENT_METHODS, {canBeMissing: true});
    const isLoadingPaymentMethodsOnyx = isLoadingOnyxValue(isLoadingPaymentMethodsResult);

    const filteredPaymentMethods = useMemo(() => {
        if (shouldShowAssignedCards) {
            const assignedCards = Object.values(isLoadingCardList ? {} : (cardList ?? {}))
                // Filter by active cards associated with a domain
                .filter((card) => !!card.domainName && CONST.EXPENSIFY_CARD.ACTIVE_STATES.includes(card.state ?? 0));
            const assignedCardsSorted = lodashSortBy(assignedCards, (card) => !isExpensifyCard(card.cardID));

            const assignedCardsGrouped: PaymentMethodItem[] = [];
            assignedCardsSorted.forEach((card) => {
                const isDisabled = card.pendingAction === CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE || !!card.errors;
                const icon = getCardFeedIcon(card.bank as CompanyCardFeed, illustrations);

                if (!isExpensifyCard(card.cardID)) {
                    const pressHandler = onPress as CardPressHandler;
                    const lastFourPAN = lastFourNumbersFromCardName(card.cardName);
                    const plaidUrl = getPlaidInstitutionIconUrl(card.bank);
                    assignedCardsGrouped.push({
                        key: card.cardID.toString(),
                        plaidUrl,
                        title: maskCardNumber(card.cardName, card.bank),
                        description: lastFourPAN
                            ? `${lastFourPAN} ${CONST.DOT_SEPARATOR} ${getDescriptionForPolicyDomainCard(card.domainName)}`
                            : getDescriptionForPolicyDomainCard(card.domainName),
                        interactive: !isDisabled,
                        disabled: isDisabled,
                        canDismissError: false,
                        shouldShowRightIcon,
                        errors: card.errors,
                        pendingAction: card.pendingAction,
                        brickRoadIndicator:
                            card.fraud === CONST.EXPENSIFY_CARD.FRAUD_TYPES.DOMAIN || card.fraud === CONST.EXPENSIFY_CARD.FRAUD_TYPES.INDIVIDUAL
                                ? CONST.BRICK_ROAD_INDICATOR_STATUS.ERROR
                                : undefined,
                        icon,
                        iconStyles: [styles.cardIcon],
                        iconWidth: variables.cardIconWidth,
                        iconHeight: variables.cardIconHeight,
                        iconRight: Expensicons.ThreeDots,
                        isMethodActive: activePaymentMethodID === card.cardID,
                        onPress: (e: GestureResponderEvent | KeyboardEvent | undefined) =>
                            pressHandler(
                                e,
                                card,
                                {
                                    icon,
                                    iconStyles: [styles.cardIcon],
                                    iconWidth: variables.cardIconWidth,
                                    iconHeight: variables.cardIconHeight,
                                },
                                card.cardID,
                            ),
                    });
                    return;
                }

                const isAdminIssuedVirtualCard = !!card?.nameValuePairs?.issuedBy && !!card?.nameValuePairs?.isVirtual;
                const isTravelCard = !!card?.nameValuePairs?.isVirtual && !!card?.nameValuePairs?.isTravelCard;

                // The card should be grouped to a specific domain and such domain already exists in a assignedCardsGrouped
                if (assignedCardsGrouped.some((item) => item.isGroupedCardDomain && item.description === card.domainName) && !isAdminIssuedVirtualCard && !isTravelCard) {
                    const domainGroupIndex = assignedCardsGrouped.findIndex((item) => item.isGroupedCardDomain && item.description === card.domainName);
                    const assignedCardsGroupedItem = assignedCardsGrouped.at(domainGroupIndex);
                    if (domainGroupIndex >= 0 && assignedCardsGroupedItem) {
                        assignedCardsGroupedItem.errors = {...assignedCardsGrouped.at(domainGroupIndex)?.errors, ...card.errors};
                        if (card.fraud === CONST.EXPENSIFY_CARD.FRAUD_TYPES.DOMAIN || card.fraud === CONST.EXPENSIFY_CARD.FRAUD_TYPES.INDIVIDUAL) {
                            assignedCardsGroupedItem.brickRoadIndicator = CONST.BRICK_ROAD_INDICATOR_STATUS.ERROR;
                        }
                    }
                    return;
                }

                // The card shouldn't be grouped or it's domain group doesn't exist yet
                const cardDescription =
                    card?.nameValuePairs?.issuedBy && card?.lastFourPAN
                        ? `${card?.lastFourPAN} ${CONST.DOT_SEPARATOR} ${getDescriptionForPolicyDomainCard(card.domainName)}`
                        : getDescriptionForPolicyDomainCard(card.domainName);
                assignedCardsGrouped.push({
                    key: card.cardID.toString(),
                    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
                    title: isTravelCard ? translate('cardPage.expensifyTravelCard') : card?.nameValuePairs?.cardTitle || card.bank,
                    description: isTravelCard ? translate('cardPage.expensifyTravelCard') : cardDescription,
                    onPress: () => Navigation.navigate(ROUTES.SETTINGS_WALLET_DOMAIN_CARD.getRoute(String(card.cardID))),
                    cardID: card.cardID,
                    isGroupedCardDomain: !isAdminIssuedVirtualCard && !isTravelCard,
                    shouldShowRightIcon: true,
                    interactive: !isDisabled,
                    disabled: isDisabled,
                    canDismissError: true,
                    errors: card.errors,
                    pendingAction: card.pendingAction,
                    brickRoadIndicator:
                        card.fraud === CONST.EXPENSIFY_CARD.FRAUD_TYPES.DOMAIN || card.fraud === CONST.EXPENSIFY_CARD.FRAUD_TYPES.INDIVIDUAL
                            ? CONST.BRICK_ROAD_INDICATOR_STATUS.ERROR
                            : undefined,
                    icon,
                    iconStyles: [styles.cardIcon],
                    iconWidth: variables.cardIconWidth,
                    iconHeight: variables.cardIconHeight,
                });
            });
            return assignedCardsGrouped;
        }

        // Hide any billing cards that are not P2P debit cards for now because you cannot make them your default method, or delete them
        // All payment cards are temporarily disabled for use as a payment method
        // const paymentCardList = fundList ?? {};
        // const filteredCardList = Object.values(paymentCardList).filter((card) => !!card.accountData?.additionalData?.isP2PDebitCard);
        const filteredCardList = {};
        let combinedPaymentMethods = formatPaymentMethods(isLoadingBankAccountList ? {} : (bankAccountList ?? {}), filteredCardList, styles);

        if (filterType !== '') {
            combinedPaymentMethods = combinedPaymentMethods.filter((paymentMethod) => paymentMethod.accountType === filterType);
        }

        if (!isOffline) {
            combinedPaymentMethods = combinedPaymentMethods.filter(
                (paymentMethod) => paymentMethod.pendingAction !== CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE || !isEmptyObject(paymentMethod.errors),
            );
        }
        combinedPaymentMethods = combinedPaymentMethods.map((paymentMethod) => {
            const pressHandler = onPress as PaymentMethodPressHandler;
            const isMethodActive = isPaymentMethodActive(actionPaymentMethodType, activePaymentMethodID, paymentMethod);
            return {
                ...paymentMethod,
                onPress: (e: GestureResponderEvent) =>
                    pressHandler(
                        e,
                        paymentMethod.accountType,
                        paymentMethod.accountData,
                        {
                            icon: paymentMethod.icon,
                            iconHeight: paymentMethod?.iconHeight,
                            iconWidth: paymentMethod?.iconWidth,
                            iconStyles: paymentMethod?.iconStyles,
                            iconSize: paymentMethod?.iconSize,
                        },
                        paymentMethod.isDefault,
                        paymentMethod.methodID,
                        paymentMethod.description,
                    ),
                wrapperStyle: isMethodActive ? [StyleUtils.getButtonBackgroundColorStyle(CONST.BUTTON_STATES.PRESSED)] : null,
                disabled: paymentMethod.pendingAction === CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE,
                isMethodActive,
                iconRight: Expensicons.ThreeDots,
                shouldShowRightIcon,
            };
        });
        return combinedPaymentMethods;
    }, [
        shouldShowAssignedCards,
        bankAccountList,
        styles,
        filterType,
        isOffline,
        cardList,
        actionPaymentMethodType,
        activePaymentMethodID,
        StyleUtils,
        shouldShowRightIcon,
        onPress,
        isLoadingBankAccountList,
        isLoadingCardList,
        illustrations,
        translate,
    ]);

    /**
     * Render placeholder when there are no payments methods
     */
    const renderListEmptyComponent = () => <Text style={styles.popoverMenuItem}>{translate('paymentMethodList.addFirstPaymentMethod')}</Text>;

    const onPressItem = useCallback(() => {
        if (!isUserValidated) {
            Navigation.navigate(ROUTES.SETTINGS_CONTACT_METHOD_VERIFY_ACCOUNT.getRoute(Navigation.getActiveRoute(), ROUTES.SETTINGS_ADD_BANK_ACCOUNT.route));
            return;
        }
        onPress();
    }, [isUserValidated, onPress]);

    const renderListFooterComponent = useCallback(
        () =>
            shouldShowAddBankAccountButton ? (
                <Button
                    ref={buttonRef}
                    key="addBankAccountButton"
                    text={translate('bankAccount.addBankAccount')}
                    large
                    success
                    onPress={onPress}
                />
            ) : (
                <MenuItem
                    onPress={onPressItem}
                    title={translate('bankAccount.addBankAccount')}
                    icon={Expensicons.Plus}
                    wrapperStyle={[styles.paymentMethod, listItemStyle]}
                    ref={buttonRef}
                />
            ),

        [shouldShowAddBankAccountButton, onPressItem, translate, onPress, buttonRef, styles.paymentMethod, listItemStyle],
    );

    const itemsToRender = useMemo(() => {
        if (!shouldShowBankAccountSections) {
            return filteredPaymentMethods;
        }
        if (
            filteredPaymentMethods.find((method) => (method as BankAccount).accountData?.type === CONST.BANK_ACCOUNT.TYPE.PERSONAL) &&
            filteredPaymentMethods.find((method) => (method as BankAccount).accountData?.type === CONST.BANK_ACCOUNT.TYPE.BUSINESS)
        ) {
            return [
                translate('walletPage.personalBankAccounts'),
                ...filteredPaymentMethods.filter((method) => (method as BankAccount).accountData?.type === CONST.BANK_ACCOUNT.TYPE.PERSONAL),
                translate('walletPage.businessBankAccounts'),
                ...filteredPaymentMethods.filter((method) => (method as BankAccount).accountData?.type === CONST.BANK_ACCOUNT.TYPE.BUSINESS),
            ];
        }
        return filteredPaymentMethods;
    }, [filteredPaymentMethods, shouldShowBankAccountSections, translate]);

    /**
     * Create a menuItem for each passed paymentMethod
     */
    const renderItem = useCallback(
        ({item, index}: RenderSuggestionMenuItemProps<PaymentMethodItem | string>) => {
            if (typeof item === 'string') {
                return (
                    <View style={[listItemStyle, index === 0 ? styles.mt4 : styles.mt6, styles.mb1]}>
                        <Text style={[styles.textLabel, styles.colorMuted]}>{item}</Text>
                    </View>
                );
            }
            return (
                <OfflineWithFeedback
                    onClose={() => dismissError(item)}
                    pendingAction={item.pendingAction}
                    errors={item.errors}
                    errorRowStyles={styles.ph6}
                    canDismissError={item.canDismissError}
                >
                    <MenuItem
                        onPress={item.onPress}
                        title={item.title}
                        description={item.description}
                        icon={item.icon}
                        plaidUrl={item.plaidUrl}
                        disabled={item.disabled}
                        iconType={item.plaidUrl ? CONST.ICON_TYPE_PLAID : CONST.ICON_TYPE_ICON}
                        displayInDefaultIconColor
                        iconHeight={item.iconHeight ?? item.iconSize}
                        iconWidth={item.iconWidth ?? item.iconSize}
                        iconStyles={item.iconStyles}
                        badgeText={
                            shouldShowDefaultBadge(
                                filteredPaymentMethods,
                                invoiceTransferBankAccountID ? invoiceTransferBankAccountID === item.methodID : item.methodID === userWallet?.walletLinkedAccountID,
                            )
                                ? translate('paymentMethodList.defaultPaymentMethod')
                                : undefined
                        }
                        wrapperStyle={[styles.paymentMethod, listItemStyle]}
                        iconRight={item.iconRight}
                        badgeStyle={styles.badgeBordered}
                        shouldShowRightIcon={item.shouldShowRightIcon}
                        shouldShowSelectedState={shouldShowSelectedState}
                        isSelected={selectedMethodID.toString() === item.methodID?.toString()}
                        interactive={item.interactive}
                        brickRoadIndicator={item.brickRoadIndicator}
                        success={item.isMethodActive}
                    />
                </OfflineWithFeedback>
            );
        },
        [
            styles.ph6,
            styles.paymentMethod,
            styles.badgeBordered,
            styles.mt4,
            styles.mt6,
            styles.mb1,
            styles.textLabel,
            styles.colorMuted,
            filteredPaymentMethods,
            invoiceTransferBankAccountID,
            userWallet?.walletLinkedAccountID,
            translate,
            listItemStyle,
            shouldShowSelectedState,
            selectedMethodID,
        ],
    );

    return (
        <>
            <View style={[style, {minHeight: (filteredPaymentMethods.length + (shouldShowAddBankAccount ? 1 : 0)) * variables.optionRowHeight}]}>
                <FlashList<PaymentMethod | string>
                    estimatedItemSize={variables.optionRowHeight}
                    data={itemsToRender}
                    renderItem={renderItem}
                    keyExtractor={keyExtractor}
                    ListEmptyComponent={shouldShowEmptyListMessage ? renderListEmptyComponent : null}
                    ListHeaderComponent={listHeaderComponent}
                    onContentSizeChange={onListContentSizeChange}
                />
                {shouldShowAddBankAccount && renderListFooterComponent()}
            </View>
            {shouldShowAddPaymentMethodButton && (
                <FormAlertWrapper>
                    {(isFormOffline) => (
                        <Button
                            text={translate('paymentMethodList.addPaymentMethod')}
                            icon={Expensicons.CreditCard}
                            onPress={onPress}
                            // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
                            isDisabled={isLoadingPaymentMethods || isFormOffline || isLoadingPaymentMethodsOnyx}
                            style={[styles.mh4, styles.buttonCTA]}
                            key="addPaymentMethodButton"
                            success
                            shouldShowRightIcon
                            large
                            ref={buttonRef}
                        />
                    )}
                </FormAlertWrapper>
            )}
        </>
    );
}

PaymentMethodList.displayName = 'PaymentMethodList';

export default PaymentMethodList;
