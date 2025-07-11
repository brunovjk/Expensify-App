import type {ValueOf} from 'type-fest';
import {dismissProductTraining} from '@libs/actions/Welcome';
import CONST from '@src/CONST';
import type {TranslationPaths} from '@src/languages/types';

const {
    CONCIERGE_LHN_GBR,
    RENAME_SAVED_SEARCH,
    BOTTOM_NAV_INBOX_TOOLTIP,
    LHN_WORKSPACE_CHAT_TOOLTIP,
    GLOBAL_CREATE_TOOLTIP,
    SCAN_TEST_TOOLTIP,
    SCAN_TEST_TOOLTIP_MANAGER,
    SCAN_TEST_CONFIRMATION,
    OUTSTANDING_FILTER,
    GBR_RBR_CHAT,
    ACCOUNT_SWITCHER,
    EXPENSE_REPORTS_FILTER,
    SCAN_TEST_DRIVE_CONFIRMATION,
    MULTI_SCAN_EDUCATIONAL_MODAL,
} = CONST.PRODUCT_TRAINING_TOOLTIP_NAMES;

type ProductTrainingTooltipName = Exclude<ValueOf<typeof CONST.PRODUCT_TRAINING_TOOLTIP_NAMES>, typeof MULTI_SCAN_EDUCATIONAL_MODAL>;

type ShouldShowConditionProps = {
    shouldUseNarrowLayout: boolean;
    isUserPolicyEmployee: boolean;
    isUserPolicyAdmin: boolean;
    hasBeenAddedToNudgeMigration: boolean;
    isUserInPaidPolicy: boolean;
};

type TooltipData = {
    content: Array<{text: TranslationPaths; isBold: boolean}>;
    onHideTooltip: (isDismissedUsingCloseButton?: boolean) => void;
    name: ProductTrainingTooltipName;
    priority: number;
    shouldShow: (props: ShouldShowConditionProps) => boolean;
    shouldRenderActionButtons?: boolean;
};

const TOOLTIPS: Record<ProductTrainingTooltipName, TooltipData> = {
    [CONCIERGE_LHN_GBR]: {
        content: [
            {text: 'productTrainingTooltip.conciergeLHNGBR.part1', isBold: false},
            {text: 'productTrainingTooltip.conciergeLHNGBR.part2', isBold: true},
        ],
        onHideTooltip: (isDismissedUsingCloseButton = false) => dismissProductTraining(CONCIERGE_LHN_GBR, isDismissedUsingCloseButton),
        name: CONCIERGE_LHN_GBR,
        priority: 1300,
        // TODO: CONCIERGE_LHN_GBR tooltip will be replaced by a tooltip in the #admins room
        // https://github.com/Expensify/App/issues/57045#issuecomment-2701455668
        shouldShow: () => false,
    },
    [RENAME_SAVED_SEARCH]: {
        content: [
            {text: 'productTrainingTooltip.saveSearchTooltip.part1', isBold: true},
            {text: 'productTrainingTooltip.saveSearchTooltip.part2', isBold: false},
        ],
        onHideTooltip: (isDismissedUsingCloseButton = false) => dismissProductTraining(RENAME_SAVED_SEARCH, isDismissedUsingCloseButton),
        name: RENAME_SAVED_SEARCH,
        priority: 1250,
        shouldShow: ({shouldUseNarrowLayout}) => !shouldUseNarrowLayout,
    },
    [GLOBAL_CREATE_TOOLTIP]: {
        content: [
            {text: 'productTrainingTooltip.globalCreateTooltip.part1', isBold: true},
            {text: 'productTrainingTooltip.globalCreateTooltip.part2', isBold: false},
            {text: 'productTrainingTooltip.globalCreateTooltip.part3', isBold: false},
            {text: 'productTrainingTooltip.globalCreateTooltip.part4', isBold: false},
        ],
        onHideTooltip: (isDismissedUsingCloseButton = false) => dismissProductTraining(GLOBAL_CREATE_TOOLTIP, isDismissedUsingCloseButton),
        name: GLOBAL_CREATE_TOOLTIP,
        priority: 1950,
        shouldShow: ({isUserPolicyEmployee}) => isUserPolicyEmployee,
    },
    [BOTTOM_NAV_INBOX_TOOLTIP]: {
        content: [
            {text: 'productTrainingTooltip.bottomNavInboxTooltip.part1', isBold: false},
            {text: 'productTrainingTooltip.bottomNavInboxTooltip.part2', isBold: true},
            {text: 'productTrainingTooltip.bottomNavInboxTooltip.part3', isBold: false},
            {text: 'productTrainingTooltip.bottomNavInboxTooltip.part4', isBold: true},
        ],
        onHideTooltip: (isDismissedUsingCloseButton = false) => dismissProductTraining(BOTTOM_NAV_INBOX_TOOLTIP, isDismissedUsingCloseButton),
        name: BOTTOM_NAV_INBOX_TOOLTIP,
        priority: 1700,
        shouldShow: ({hasBeenAddedToNudgeMigration}) => hasBeenAddedToNudgeMigration,
    },
    [LHN_WORKSPACE_CHAT_TOOLTIP]: {
        content: [
            {text: 'productTrainingTooltip.workspaceChatTooltip.part1', isBold: false},
            {text: 'productTrainingTooltip.workspaceChatTooltip.part2', isBold: true},
        ],
        onHideTooltip: (isDismissedUsingCloseButton = false) => dismissProductTraining(LHN_WORKSPACE_CHAT_TOOLTIP, isDismissedUsingCloseButton),
        name: LHN_WORKSPACE_CHAT_TOOLTIP,
        priority: 1800,
        shouldShow: ({isUserPolicyEmployee}) => isUserPolicyEmployee,
    },
    [GBR_RBR_CHAT]: {
        content: [
            {text: 'productTrainingTooltip.GBRRBRChat.part1', isBold: false},
            {text: 'productTrainingTooltip.GBRRBRChat.part2', isBold: true},
            {text: 'productTrainingTooltip.GBRRBRChat.part3', isBold: false},
            {text: 'productTrainingTooltip.GBRRBRChat.part4', isBold: true},
        ],
        onHideTooltip: () => dismissProductTraining(GBR_RBR_CHAT),
        name: GBR_RBR_CHAT,
        priority: 1900,
        shouldShow: () => true,
    },
    [ACCOUNT_SWITCHER]: {
        content: [
            {text: 'productTrainingTooltip.accountSwitcher.part1', isBold: false},
            {text: 'productTrainingTooltip.accountSwitcher.part2', isBold: true},
            {text: 'productTrainingTooltip.accountSwitcher.part3', isBold: false},
        ],
        onHideTooltip: () => dismissProductTraining(ACCOUNT_SWITCHER),
        name: ACCOUNT_SWITCHER,
        priority: 1600,
        shouldShow: () => true,
    },
    [EXPENSE_REPORTS_FILTER]: {
        content: [
            {text: 'productTrainingTooltip.expenseReportsFilter.part1', isBold: false},
            {text: 'productTrainingTooltip.expenseReportsFilter.part2', isBold: true},
            {text: 'productTrainingTooltip.expenseReportsFilter.part3', isBold: false},
        ],
        onHideTooltip: () => dismissProductTraining(EXPENSE_REPORTS_FILTER),
        name: EXPENSE_REPORTS_FILTER,
        priority: 2000,
        shouldShow: ({shouldUseNarrowLayout, isUserPolicyAdmin, hasBeenAddedToNudgeMigration}: ShouldShowConditionProps) =>
            !shouldUseNarrowLayout && isUserPolicyAdmin && hasBeenAddedToNudgeMigration,
    },
    [SCAN_TEST_TOOLTIP]: {
        content: [
            {text: 'productTrainingTooltip.scanTestTooltip.part1', isBold: true},
            {text: 'productTrainingTooltip.scanTestTooltip.part2', isBold: false},
        ],
        onHideTooltip: () => dismissProductTraining(SCAN_TEST_TOOLTIP),
        name: SCAN_TEST_TOOLTIP,
        priority: 900,
        shouldShow: ({isUserInPaidPolicy, hasBeenAddedToNudgeMigration}) => !isUserInPaidPolicy && !hasBeenAddedToNudgeMigration,
        shouldRenderActionButtons: true,
    },
    [SCAN_TEST_TOOLTIP_MANAGER]: {
        content: [
            {text: 'productTrainingTooltip.scanTestTooltip.part3', isBold: false},
            {text: 'productTrainingTooltip.scanTestTooltip.part4', isBold: true},
            {text: 'productTrainingTooltip.scanTestTooltip.part5', isBold: false},
        ],
        onHideTooltip: (isDismissedUsingCloseButton = false) => dismissProductTraining(SCAN_TEST_TOOLTIP_MANAGER, isDismissedUsingCloseButton),
        name: SCAN_TEST_TOOLTIP_MANAGER,
        priority: 1000,
        shouldShow: ({hasBeenAddedToNudgeMigration}) => !hasBeenAddedToNudgeMigration,
    },
    [SCAN_TEST_CONFIRMATION]: {
        content: [
            {text: 'productTrainingTooltip.scanTestTooltip.part6', isBold: false},
            {text: 'productTrainingTooltip.scanTestTooltip.part7', isBold: true},
            {text: 'productTrainingTooltip.scanTestTooltip.part8', isBold: false},
        ],
        onHideTooltip: (isDismissedUsingCloseButton = false) => dismissProductTraining(SCAN_TEST_CONFIRMATION, isDismissedUsingCloseButton),
        name: SCAN_TEST_CONFIRMATION,
        priority: 1100,
        shouldShow: ({hasBeenAddedToNudgeMigration}) => !hasBeenAddedToNudgeMigration,
    },
    [OUTSTANDING_FILTER]: {
        content: [
            {text: 'productTrainingTooltip.outstandingFilter.part1', isBold: false},
            {text: 'productTrainingTooltip.outstandingFilter.part2', isBold: true},
        ],
        onHideTooltip: () => dismissProductTraining(OUTSTANDING_FILTER),
        name: OUTSTANDING_FILTER,
        priority: 1925,
        shouldShow: ({isUserPolicyAdmin}) => isUserPolicyAdmin,
    },
    [SCAN_TEST_DRIVE_CONFIRMATION]: {
        content: [
            {text: 'productTrainingTooltip.scanTestDriveTooltip.part1', isBold: false},
            {text: 'productTrainingTooltip.scanTestDriveTooltip.part2', isBold: true},
        ],
        onHideTooltip: (isDismissedUsingCloseButton = false) => dismissProductTraining(SCAN_TEST_DRIVE_CONFIRMATION, isDismissedUsingCloseButton),
        name: SCAN_TEST_DRIVE_CONFIRMATION,
        priority: 1200,
        shouldShow: () => true,
    },
};

export default TOOLTIPS;
export type {ProductTrainingTooltipName};
