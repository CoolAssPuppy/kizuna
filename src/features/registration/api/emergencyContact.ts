import type { EmergencyContactRow } from '../types';
import { createUserScopedRepository } from './userScopedRepository';

type EmergencyContactForm = Pick<
  EmergencyContactRow,
  'full_name' | 'relationship' | 'phone_primary' | 'phone_secondary' | 'email' | 'notes'
>;

const repo = createUserScopedRepository<'emergency_contacts', EmergencyContactForm>({
  table: 'emergency_contacts',
  toInsert: (userId, values) => ({
    user_id: userId,
    full_name: values.full_name,
    relationship: values.relationship,
    phone_primary: values.phone_primary,
    phone_secondary: values.phone_secondary,
    email: values.email,
    notes: values.notes,
  }),
});

export const loadEmergencyContact = repo.load;
export const saveEmergencyContact = repo.save;
