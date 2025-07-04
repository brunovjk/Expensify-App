import {createRef} from 'react';
import type {MutableRefObject} from 'react';
import type {GestureResponderEvent} from 'react-native';
import type {OnyxEntry, OnyxUpdate} from 'react-native-onyx';
import Onyx from 'react-native-onyx';
import type {ValueOf} from 'type-fest';
import * as API from '@libs/API';
import type {
    AddPaymentCardParams,
    DeletePaymentCardParams,
    MakeDefaultPaymentMethodParams,
    PaymentCardParams,
    SetInvoicingTransferBankAccountParams,
    TransferWalletBalanceParams,
    UpdateBillingCurrencyParams,
} from '@libs/API/parameters';
import {READ_COMMANDS, WRITE_COMMANDS} from '@libs/API/types';
import * as CardUtils from '@libs/CardUtils';
import GoogleTagManager from '@libs/GoogleTagManager';
import Log from '@libs/Log';
import Navigation from '@libs/Navigation/Navigation';
import {getCardForSubscriptionBilling} from '@libs/SubscriptionUtils';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Route} from '@src/ROUTES';
import INPUT_IDS from '@src/types/form/AddPaymentCardForm';
import type {BankAccountList, FundList} from '@src/types/onyx';
import type {PaymentMethodType} from '@src/types/onyx/OriginalMessage';
import type PaymentMethod from '@src/types/onyx/PaymentMethod';
import type {OnyxData} from '@src/types/onyx/Request';
import type {FilterMethodPaymentType} from '@src/types/onyx/WalletTransfer';

type KYCWallRef = {
    continueAction?: (event?: GestureResponderEvent | KeyboardEvent, iouPaymentType?: PaymentMethodType) => void;
};

/**
 * Sets up a ref to an instance of the KYC Wall component.
 */
const kycWallRef: MutableRefObject<KYCWallRef | null> = createRef<KYCWallRef>();

/**
 * When we successfully add a payment method or pass the KYC checks we will continue with our setup action if we have one set.
 */
function continueSetup(fallbackRoute?: Route) {
    if (!kycWallRef.current?.continueAction) {
        Navigation.goBack(fallbackRoute);
        return;
    }

    // Close the screen (Add Debit Card, Add Bank Account, or Enable Payments) on success and continue with setup
    Navigation.goBack(fallbackRoute);
    kycWallRef.current.continueAction();
}

function openWalletPage() {
    const optimisticData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: ONYXKEYS.IS_LOADING_PAYMENT_METHODS,
            value: true,
        },
    ];
    const successData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: ONYXKEYS.IS_LOADING_PAYMENT_METHODS,
            value: false,
        },
    ];
    const failureData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: ONYXKEYS.IS_LOADING_PAYMENT_METHODS,
            value: false,
        },
    ];

    return API.read(READ_COMMANDS.OPEN_PAYMENTS_PAGE, null, {
        optimisticData,
        successData,
        failureData,
    });
}

function getMakeDefaultPaymentOnyxData(
    bankAccountID: number,
    fundID: number,
    previousPaymentMethod?: PaymentMethod,
    currentPaymentMethod?: PaymentMethod,
    isOptimisticData = true,
): OnyxUpdate[] {
    const onyxData: OnyxUpdate[] = [
        isOptimisticData
            ? {
                  onyxMethod: Onyx.METHOD.MERGE,
                  key: ONYXKEYS.USER_WALLET,
                  value: {
                      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
                      walletLinkedAccountID: bankAccountID || fundID,
                      walletLinkedAccountType: bankAccountID ? CONST.PAYMENT_METHODS.PERSONAL_BANK_ACCOUNT : CONST.PAYMENT_METHODS.DEBIT_CARD,
                      // Only clear the error if this is optimistic data. If this is failure data, we do not want to clear the error that came from the server.
                      errors: null,
                  },
              }
            : {
                  onyxMethod: Onyx.METHOD.MERGE,
                  key: ONYXKEYS.USER_WALLET,
                  value: {
                      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
                      walletLinkedAccountID: bankAccountID || fundID,
                      walletLinkedAccountType: bankAccountID ? CONST.PAYMENT_METHODS.PERSONAL_BANK_ACCOUNT : CONST.PAYMENT_METHODS.DEBIT_CARD,
                  },
              },
    ];

    if (previousPaymentMethod?.methodID) {
        onyxData.push({
            onyxMethod: Onyx.METHOD.MERGE,
            key: previousPaymentMethod.accountType === CONST.PAYMENT_METHODS.PERSONAL_BANK_ACCOUNT ? ONYXKEYS.BANK_ACCOUNT_LIST : ONYXKEYS.FUND_LIST,
            value: {
                [previousPaymentMethod.methodID]: {
                    isDefault: !isOptimisticData,
                },
            },
        });
    }

    if (currentPaymentMethod?.methodID) {
        onyxData.push({
            onyxMethod: Onyx.METHOD.MERGE,
            key: currentPaymentMethod.accountType === CONST.PAYMENT_METHODS.PERSONAL_BANK_ACCOUNT ? ONYXKEYS.BANK_ACCOUNT_LIST : ONYXKEYS.FUND_LIST,
            value: {
                [currentPaymentMethod.methodID]: {
                    isDefault: isOptimisticData,
                },
            },
        });
    }

    return onyxData;
}

/**
 * Sets the default bank account or debit card for an Expensify Wallet
 *
 */
function makeDefaultPaymentMethod(bankAccountID: number, fundID: number, previousPaymentMethod?: PaymentMethod, currentPaymentMethod?: PaymentMethod) {
    const parameters: MakeDefaultPaymentMethodParams = {
        bankAccountID,
        fundID,
    };

    API.write(WRITE_COMMANDS.MAKE_DEFAULT_PAYMENT_METHOD, parameters, {
        optimisticData: getMakeDefaultPaymentOnyxData(bankAccountID, fundID, previousPaymentMethod, currentPaymentMethod, true),
        failureData: getMakeDefaultPaymentOnyxData(bankAccountID, fundID, previousPaymentMethod, currentPaymentMethod, false),
    });
}

/**
 * Calls the API to add a new card.
 *
 */
function addPaymentCard(accountID: number, params: PaymentCardParams) {
    const cardMonth = CardUtils.getMonthFromExpirationDateString(params.expirationDate);
    const cardYear = CardUtils.getYearFromExpirationDateString(params.expirationDate);

    const parameters: AddPaymentCardParams = {
        cardNumber: CardUtils.getMCardNumberString(params.cardNumber),
        cardYear,
        cardMonth,
        cardCVV: params.securityCode,
        addressName: params.nameOnCard,
        addressZip: params.addressZipCode,
        currency: CONST.PAYMENT_CARD_CURRENCY.USD,
        isP2PDebitCard: true,
    };

    const optimisticData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: ONYXKEYS.FORMS.ADD_PAYMENT_CARD_FORM,
            value: {isLoading: true},
        },
    ];

    const successData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: ONYXKEYS.FORMS.ADD_PAYMENT_CARD_FORM,
            value: {isLoading: false},
        },
    ];

    const failureData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: ONYXKEYS.FORMS.ADD_PAYMENT_CARD_FORM,
            value: {isLoading: false},
        },
    ];

    API.write(WRITE_COMMANDS.ADD_PAYMENT_CARD, parameters, {
        optimisticData,
        successData,
        failureData,
    });

    GoogleTagManager.publishEvent(CONST.ANALYTICS.EVENT.PAID_ADOPTION, accountID);
}

/**
 * Calls the API to add a new card.
 *
 */
function addSubscriptionPaymentCard(
    accountID: number,
    cardData: {
        cardNumber: string;
        cardYear: string;
        cardMonth: string;
        cardCVV: string;
        addressName: string;
        addressZip: string;
        currency: ValueOf<typeof CONST.PAYMENT_CARD_CURRENCY>;
    },
) {
    const {cardNumber, cardYear, cardMonth, cardCVV, addressName, addressZip, currency} = cardData;

    const parameters: AddPaymentCardParams = {
        cardNumber,
        cardYear,
        cardMonth,
        cardCVV,
        addressName,
        addressZip,
        currency,
        isP2PDebitCard: false,
        shouldClaimEarlyDiscountOffer: true,
    };

    const optimisticData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: ONYXKEYS.FORMS.ADD_PAYMENT_CARD_FORM,
            value: {isLoading: true},
        },
    ];

    const successData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: ONYXKEYS.FORMS.ADD_PAYMENT_CARD_FORM,
            value: {isLoading: false},
        },
    ];

    const failureData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: ONYXKEYS.FORMS.ADD_PAYMENT_CARD_FORM,
            value: {isLoading: false},
        },
    ];

    if (CONST.SCA_CURRENCIES.has(currency)) {
        addPaymentCardSCA(parameters, {optimisticData, successData, failureData});
    } else {
        // eslint-disable-next-line rulesdir/no-multiple-api-calls
        API.write(WRITE_COMMANDS.ADD_PAYMENT_CARD, parameters, {
            optimisticData,
            successData,
            failureData,
        });
    }
    if (getCardForSubscriptionBilling()) {
        Log.info(`[GTM] Not logging ${CONST.ANALYTICS.EVENT.PAID_ADOPTION} because a card was already added`);
    } else {
        GoogleTagManager.publishEvent(CONST.ANALYTICS.EVENT.PAID_ADOPTION, accountID);
    }
}

/**
 * Calls the API to add a new SCA (GBP or EUR) card.
 * Updates verify3dsSubscription Onyx key with a new authentication link for 3DS.
 */
function addPaymentCardSCA(params: AddPaymentCardParams, onyxData: OnyxData = {}) {
    API.write(WRITE_COMMANDS.ADD_PAYMENT_CARD_SCA, params, onyxData);
}

/**
 * Resets the values for the add payment card form back to their initial states
 */
function clearPaymentCardFormErrorAndSubmit() {
    Onyx.set(ONYXKEYS.FORMS.ADD_PAYMENT_CARD_FORM, {
        isLoading: false,
        errors: undefined,
        [INPUT_IDS.SETUP_COMPLETE]: false,
        [INPUT_IDS.NAME_ON_CARD]: '',
        [INPUT_IDS.CARD_NUMBER]: '',
        [INPUT_IDS.EXPIRATION_DATE]: '',
        [INPUT_IDS.SECURITY_CODE]: '',
        [INPUT_IDS.ADDRESS_STREET]: '',
        [INPUT_IDS.ADDRESS_ZIP_CODE]: '',
        [INPUT_IDS.ADDRESS_STATE]: '',
        [INPUT_IDS.ACCEPT_TERMS]: '',
        [INPUT_IDS.CURRENCY]: CONST.PAYMENT_CARD_CURRENCY.USD,
    });
}

/**
 * Clear 3ds flow - when verification will be finished
 *
 */
function clearPaymentCard3dsVerification() {
    Onyx.set(ONYXKEYS.VERIFY_3DS_SUBSCRIPTION, '');
}

/**
 * Properly updates the nvp_privateStripeCustomerID onyx data for 3DS payment
 *
 */
function verifySetupIntent(accountID: number, isVerifying = true) {
    API.write(WRITE_COMMANDS.VERIFY_SETUP_INTENT, {accountID, isVerifying});
}

/**
 * Set currency for payments
 *
 */
function setPaymentMethodCurrency(currency: ValueOf<typeof CONST.PAYMENT_CARD_CURRENCY>) {
    Onyx.merge(ONYXKEYS.FORMS.ADD_PAYMENT_CARD_FORM, {
        [INPUT_IDS.CURRENCY]: currency,
    });
}

/**
 * Call the API to transfer wallet balance.
 *
 */
function transferWalletBalance(paymentMethod: PaymentMethod) {
    const paymentMethodIDKey =
        paymentMethod.accountType === CONST.PAYMENT_METHODS.PERSONAL_BANK_ACCOUNT ? CONST.PAYMENT_METHOD_ID_KEYS.BANK_ACCOUNT : CONST.PAYMENT_METHOD_ID_KEYS.DEBIT_CARD;

    const parameters: TransferWalletBalanceParams = {
        [paymentMethodIDKey]: paymentMethod.methodID,
    };

    const optimisticData: OnyxUpdate[] = [
        {
            onyxMethod: 'merge',
            key: ONYXKEYS.WALLET_TRANSFER,
            value: {
                loading: true,
                errors: null,
            },
        },
    ];

    const successData: OnyxUpdate[] = [
        {
            onyxMethod: 'merge',
            key: ONYXKEYS.WALLET_TRANSFER,
            value: {
                loading: false,
                shouldShowSuccess: true,
                paymentMethodType: paymentMethod.accountType,
            },
        },
    ];

    const failureData: OnyxUpdate[] = [
        {
            onyxMethod: 'merge',
            key: ONYXKEYS.WALLET_TRANSFER,
            value: {
                loading: false,
                shouldShowSuccess: false,
            },
        },
    ];

    API.write(WRITE_COMMANDS.TRANSFER_WALLET_BALANCE, parameters, {
        optimisticData,
        successData,
        failureData,
    });
}

function resetWalletTransferData() {
    Onyx.merge(ONYXKEYS.WALLET_TRANSFER, {
        selectedAccountType: '',
        selectedAccountID: null,
        filterPaymentMethodType: null,
        loading: false,
        shouldShowSuccess: false,
    });
}

function saveWalletTransferAccountTypeAndID(selectedAccountType: string | undefined, selectedAccountID: string | undefined) {
    Onyx.merge(ONYXKEYS.WALLET_TRANSFER, {selectedAccountType, selectedAccountID});
}

/**
 * Toggles the user's selected type of payment method (bank account or debit card) on the wallet transfer balance screen.
 *
 */
function saveWalletTransferMethodType(filterPaymentMethodType?: FilterMethodPaymentType) {
    Onyx.merge(ONYXKEYS.WALLET_TRANSFER, {filterPaymentMethodType});
}

function dismissSuccessfulTransferBalancePage() {
    Onyx.merge(ONYXKEYS.WALLET_TRANSFER, {shouldShowSuccess: false});
    Navigation.goBack();
}

/**
 * Looks through each payment method to see if there is an existing error
 *
 */
function hasPaymentMethodError(bankList: OnyxEntry<BankAccountList>, fundList: OnyxEntry<FundList>): boolean {
    const combinedPaymentMethods = {...bankList, ...fundList};

    return Object.values(combinedPaymentMethods).some((item) => Object.keys(item.errors ?? {}).length);
}

type PaymentListKey =
    | typeof ONYXKEYS.BANK_ACCOUNT_LIST
    | typeof ONYXKEYS.FUND_LIST
    | typeof ONYXKEYS.CARD_LIST
    | `${typeof ONYXKEYS.COLLECTION.WORKSPACE_CARDS_LIST}${string}_${typeof CONST.EXPENSIFY_CARD.BANK}`;

/**
 * Clears the error for the specified payment item
 * @param paymentListKey The onyx key for the provided payment method
 * @param paymentMethodID
 */
function clearDeletePaymentMethodError(paymentListKey: PaymentListKey, paymentMethodID: number) {
    Onyx.merge(paymentListKey, {
        [paymentMethodID]: {
            pendingAction: null,
            errors: null,
        },
    });
}

/**
 * If there was a failure adding a payment method, clearing it removes the payment method from the list entirely
 * @param paymentListKey The onyx key for the provided payment method
 * @param paymentMethodID
 */
function clearAddPaymentMethodError(paymentListKey: PaymentListKey, paymentMethodID: number) {
    Onyx.merge(paymentListKey, {
        [paymentMethodID]: null,
    });
}

/**
 * Clear any error(s) related to the user's wallet
 */
function clearWalletError() {
    Onyx.merge(ONYXKEYS.USER_WALLET, {errors: null});
}

/**
 * Clear any error(s) related to the user's wallet terms
 */
function clearWalletTermsError() {
    Onyx.merge(ONYXKEYS.WALLET_TERMS, {errors: null});
}

function deletePaymentCard(fundID: number) {
    const parameters: DeletePaymentCardParams = {
        fundID,
    };

    const optimisticData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.FUND_LIST}`,
            value: {[fundID]: {pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE}},
        },
    ];

    API.write(WRITE_COMMANDS.DELETE_PAYMENT_CARD, parameters, {
        optimisticData,
    });
}

/**
 * Call the API to change billing currency.
 *
 */
function updateBillingCurrency(currency: ValueOf<typeof CONST.PAYMENT_CARD_CURRENCY>, cardCVV: string) {
    const parameters: UpdateBillingCurrencyParams = {
        cardCVV,
        currency,
    };

    const optimisticData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: ONYXKEYS.FORMS.CHANGE_BILLING_CURRENCY_FORM,
            value: {
                isLoading: true,
                errors: null,
            },
        },
    ];

    const successData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: ONYXKEYS.FORMS.CHANGE_BILLING_CURRENCY_FORM,
            value: {
                isLoading: false,
            },
        },
    ];

    const failureData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: ONYXKEYS.FORMS.CHANGE_BILLING_CURRENCY_FORM,
            value: {
                isLoading: false,
            },
        },
    ];

    API.write(WRITE_COMMANDS.UPDATE_BILLING_CARD_CURRENCY, parameters, {
        optimisticData,
        successData,
        failureData,
    });
}

/**
 *  Sets the default bank account to use for receiving payouts from
 *
 */
function setInvoicingTransferBankAccount(bankAccountID: number, policyID: string, previousBankAccountID: number) {
    const parameters: SetInvoicingTransferBankAccountParams = {
        bankAccountID,
        policyID,
    };

    const optimisticData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: {
                invoice: {
                    bankAccount: {
                        transferBankAccountID: bankAccountID,
                    },
                },
            },
        },
    ];

    const failureData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: {
                invoice: {
                    bankAccount: {
                        transferBankAccountID: previousBankAccountID,
                    },
                },
            },
        },
    ];

    API.write(WRITE_COMMANDS.SET_INVOICING_TRANSFER_BANK_ACCOUNT, parameters, {
        optimisticData,
        failureData,
    });
}

export {
    deletePaymentCard,
    addPaymentCard,
    openWalletPage,
    makeDefaultPaymentMethod,
    kycWallRef,
    continueSetup,
    addSubscriptionPaymentCard,
    clearPaymentCardFormErrorAndSubmit,
    dismissSuccessfulTransferBalancePage,
    transferWalletBalance,
    resetWalletTransferData,
    saveWalletTransferAccountTypeAndID,
    saveWalletTransferMethodType,
    hasPaymentMethodError,
    updateBillingCurrency,
    clearDeletePaymentMethodError,
    clearAddPaymentMethodError,
    clearWalletError,
    setPaymentMethodCurrency,
    clearPaymentCard3dsVerification,
    clearWalletTermsError,
    verifySetupIntent,
    addPaymentCardSCA,
    setInvoicingTransferBankAccount,
};
