import type { Database } from '@/types/database.types';

export type RegistrationRow = Database['public']['Tables']['registrations']['Row'];
export type RegistrationTaskRow = Database['public']['Tables']['registration_tasks']['Row'];
export type EmployeeProfileRow = Database['public']['Tables']['employee_profiles']['Row'];
export type DietaryRow = Database['public']['Tables']['dietary_preferences']['Row'];
export type EmergencyContactRow = Database['public']['Tables']['emergency_contacts']['Row'];
export type AdditionalGuestRow = Database['public']['Tables']['additional_guests']['Row'];
export type RegistrationStatus = RegistrationRow['status'];
export type RegistrationTaskKey = RegistrationTaskRow['task_key'];
export type RegistrationTaskStatus = RegistrationTaskRow['status'];

export interface RegistrationBundle {
  registration: RegistrationRow;
  tasks: RegistrationTaskRow[];
}
