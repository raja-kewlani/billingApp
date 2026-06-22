import { BaseEntity } from './base';

/**
 * Represents a Firm (Tenancy Boundary).
 */
export interface Firm extends BaseEntity {
  name: string;
  mailing_name?: string;
  address_lane1?: string;
  city?: string;
  state?: string;
  pincode?: string;
  mobile?: string;
  email?: string;
  registration_type: string;
  gstin?: string;
  pan?: string;
  bank_name?: string;
  account_number?: string;
  ifsc_code?: string;
  branch_name?: string;
  parent_firm_id: string | null; // Null for CA firms, UUID for Merchant firms
  has_unresolved_feedback?: boolean;
}

/**
 * Interface for data required to create a new Firm.
 */
export type FirmCreate = Omit<Firm, 'id' | 'created_at' | 'updated_at'>;
