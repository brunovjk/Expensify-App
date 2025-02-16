import type {BeneficialOwnersStepProps} from '@src/types/form/ReimbursementAccountForm';

type UpdateBeneficialOwnersForBankAccountParams = Partial<BeneficialOwnersStepProps> & {bankAccountID: number; policyID: string | undefined};

export default UpdateBeneficialOwnersForBankAccountParams;
