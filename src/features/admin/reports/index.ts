/**
 * Admin reports barrel. Each report has its own row interface and fetch
 * function in a sibling module. The shapes are stable because the CSV
 * column order is part of the contract with hotel/transport recipients.
 */

export { fetchDietarySummary, type DietaryRow } from './dietary';
export { fetchPaymentReconciliation, type PaymentReconciliationRow } from './payments';
export { fetchRegistrationProgress, type RegistrationProgressRow } from './registration';
export { fetchRoomingList, type RoomingRow } from './rooming';
export {
  fetchSwagOrder,
  fetchSwagOrderTotals,
  type SwagOrderRow,
  type SwagTotalsRow,
} from './swag';
export { fetchTransportManifest, type TransportManifestRow } from './transport';
