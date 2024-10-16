import React, {useEffect, useState} from 'react';
import {View} from 'react-native';
import type {StyleProp, ViewStyle} from 'react-native';
import {useOnyx} from 'react-native-onyx';
import type {ValueOf} from 'type-fest';
import FormHelpMessage from '@components/FormHelpMessage';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import Icon from '@components/Icon';
import * as Illustrations from '@components/Icon/Illustrations';
import type {LocaleContextProps} from '@components/LocaleContextProvider';
import ScreenWrapper from '@components/ScreenWrapper';
import SelectionList from '@components/SelectionList';
import RadioListItem from '@components/SelectionList/RadioListItem';
import Text from '@components/Text';
import useLocalize from '@hooks/useLocalize';
import usePermissions from '@hooks/usePermissions';
import useThemeStyles from '@hooks/useThemeStyles';
import Navigation from '@navigation/Navigation';
import variables from '@styles/variables';
import * as CompanyCards from '@userActions/CompanyCards';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';

type AvailableCompanyCardTypes = {
    isAmexAvailable?: boolean;
    translate: LocaleContextProps['translate'];
    typeSelected?: ValueOf<typeof CONST.COMPANY_CARDS.CARD_TYPE>;
    styles: StyleProp<ViewStyle>;
};

function getAvailableCompanyCardTypes({isAmexAvailable, translate, typeSelected, styles}: AvailableCompanyCardTypes) {
    const defaultTypes = [
        {
            value: CONST.COMPANY_CARDS.CARD_TYPE.MASTERCARD,
            text: translate('workspace.companyCards.addNewCard.cardProviders.mastercard'),
            keyForList: CONST.COMPANY_CARDS.CARD_TYPE.MASTERCARD,
            isSelected: typeSelected === CONST.COMPANY_CARDS.CARD_TYPE.MASTERCARD,
            leftElement: (
                <Icon
                    src={Illustrations.MasterCardCompanyCardDetail}
                    height={variables.iconSizeExtraLarge}
                    width={variables.iconSizeExtraLarge}
                    additionalStyles={styles}
                />
            ),
        },
        {
            value: CONST.COMPANY_CARDS.CARD_TYPE.VISA,
            text: translate('workspace.companyCards.addNewCard.cardProviders.visa'),
            keyForList: CONST.COMPANY_CARDS.CARD_TYPE.VISA,
            isSelected: typeSelected === CONST.COMPANY_CARDS.CARD_TYPE.VISA,
            leftElement: (
                <Icon
                    src={Illustrations.VisaCompanyCardDetail}
                    height={variables.iconSizeExtraLarge}
                    width={variables.iconSizeExtraLarge}
                    additionalStyles={styles}
                />
            ),
        },
    ];

    if (!isAmexAvailable) {
        return defaultTypes;
    }

    return [
        {
            value: CONST.COMPANY_CARDS.CARD_TYPE.AMEX,
            text: translate('workspace.companyCards.addNewCard.cardProviders.amex'),
            keyForList: CONST.COMPANY_CARDS.CARD_TYPE.AMEX,
            isSelected: typeSelected === CONST.COMPANY_CARDS.CARD_TYPE.AMEX,
            leftElement: (
                <Icon
                    src={Illustrations.AmexCardCompanyCardDetail}
                    height={variables.iconSizeExtraLarge}
                    width={variables.iconSizeExtraLarge}
                    additionalStyles={styles}
                />
            ),
        },
        ...defaultTypes,
    ];
}

function CardTypeStep() {
    const {translate} = useLocalize();
    const styles = useThemeStyles();
    const [addNewCard] = useOnyx(ONYXKEYS.ADD_NEW_COMPANY_CARD);
    const [typeSelected, setTypeSelected] = useState<ValueOf<typeof CONST.COMPANY_CARDS.CARD_TYPE>>();
    const {canUseDirectFeeds} = usePermissions();
    const [isError, setIsError] = useState(false);
    const data = getAvailableCompanyCardTypes({isAmexAvailable: !canUseDirectFeeds, translate, typeSelected, styles: styles.mr3});

    const submit = () => {
        if (!typeSelected) {
            setIsError(true);
        } else {
            CompanyCards.setAddNewCompanyCardStepAndData({
                step: CONST.COMPANY_CARDS.STEP.CARD_INSTRUCTIONS,
                data: {
                    cardType: typeSelected,
                },
                isEditing: false,
            });
        }
    };

    useEffect(() => {
        setTypeSelected(addNewCard?.data.cardType);
    }, [addNewCard?.data.cardType]);

    const handleBackButtonPress = () => {
        if (canUseDirectFeeds) {
            CompanyCards.setAddNewCompanyCardStepAndData({step: CONST.COMPANY_CARDS.STEP.SELECT_BANK});
        } else {
            Navigation.goBack();
        }
    };

    return (
        <ScreenWrapper
            testID={CardTypeStep.displayName}
            includeSafeAreaPaddingBottom={false}
            shouldEnablePickerAvoiding={false}
            shouldEnableMaxHeight
        >
            <HeaderWithBackButton
                title={translate('workspace.companyCards.addCardFeed')}
                onBackButtonPress={handleBackButtonPress}
            />

            <Text style={[styles.textHeadlineLineHeightXXL, styles.ph5, styles.mv3]}>{translate('workspace.companyCards.addNewCard.yourCardProvider')}</Text>
            <SelectionList
                ListItem={RadioListItem}
                onSelectRow={({value}) => {
                    setTypeSelected(value);
                    setIsError(false);
                }}
                sections={[{data}]}
                shouldSingleExecuteRowSelect
                initiallyFocusedOptionKey={addNewCard?.data.cardType}
                shouldUpdateFocusedIndex
                showConfirmButton
                confirmButtonText={translate('common.next')}
                onConfirm={submit}
            >
                {isError && (
                    <View style={[styles.ph5, styles.mb3]}>
                        <FormHelpMessage
                            isError={isError}
                            message={translate('workspace.companyCards.addNewCard.error.pleaseSelectProvider')}
                        />
                    </View>
                )}
            </SelectionList>
        </ScreenWrapper>
    );
}

CardTypeStep.displayName = 'CardTypeStep';

export default CardTypeStep;
