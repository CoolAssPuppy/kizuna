-- Shared enum types
--
-- Defined once here so every reference in the schema below is type-safe and
-- consistent. Adding a value: `alter type <name> add value '<new>';` (cannot
-- remove or rename safely without rebuilding dependent tables).

-- Identity and access
create type user_role as enum ('employee', 'guest', 'admin', 'super_admin');
create type auth_provider as enum ('sso', 'email_password');

-- Field provenance and conflict tracking
create type field_source_type as enum ('hibob', 'perk', 'user_entered', 'admin_set');
create type external_source_type as enum ('hibob', 'perk');
create type conflict_status as enum ('open', 'accepted_kizuna', 'accepted_external', 'pushed_to_source');

-- Sync infrastructure
create type sync_status as enum ('success', 'partial', 'failed');

-- Registration
create type registration_status as enum ('invited', 'started', 'complete', 'cancelled');
create type registration_task_key as enum (
  'personal_info',
  'passport',
  'emergency_contact',
  'dietary',
  'accessibility',
  'swag',
  'transport',
  'guest',
  'documents',
  'flight'
);
create type registration_task_status as enum ('pending', 'complete', 'skipped', 'waived');
create type task_audience as enum ('all', 'employee_only', 'guest_only');
create type custom_field_audience as enum ('all', 'employee', 'guest');
create type custom_field_type as enum ('text', 'select', 'boolean', 'number', 'date');

-- Documents and consent
create type document_audience as enum ('all', 'employee', 'guest');
create type document_content_type as enum ('markdown', 'pdf', 'notion');

-- Guests
create type guest_relationship as enum ('partner', 'family', 'friend', 'other');
create type guest_payment_status as enum ('pending', 'paid', 'waived', 'refunded', 'failed');
create type guest_invitation_status as enum ('pending', 'accepted', 'expired', 'cancelled');

-- Dietary
create type dietary_severity as enum ('preference', 'intolerance', 'allergy');

-- Logistics
create type flight_direction as enum ('inbound', 'outbound');
create type flight_source_type as enum ('perk_sync', 'perk_csv', 'manual_obs');
create type transport_direction as enum ('arrival', 'departure');
create type ground_transport_need as enum ('none', 'arrival', 'departure', 'both');

-- Events and sessions
create type event_type as enum ('supafest', 'select', 'meetup');
create type session_type as enum ('keynote', 'breakout', 'workshop', 'dinner', 'activity', 'transport', 'social');
create type session_audience as enum ('all', 'employees_only', 'guests_only', 'opt_in');
create type session_registration_status as enum ('registered', 'waitlisted', 'attended', 'no_show');

-- Itinerary
create type itinerary_item_type as enum ('session', 'flight', 'transport', 'accommodation', 'announcement', 'reminder');
create type itinerary_source as enum ('assigned', 'self_registered', 'self_imported', 'auto_all');

-- Community
create type vote_target_type as enum ('session', 'idea', 'announcement');
create type attendee_visibility as enum ('public', 'attendees_only', 'private');

-- Reports
create type report_type as enum (
  'rooming_list',
  'transport_manifest',
  'dietary_summary',
  'swag_order',
  'full_registration',
  'payment_reconciliation'
);

-- Notifications
create type notification_channel as enum ('slack', 'email', 'in_app');
create type notification_type as enum (
  'nudge',
  'deadline_reminder',
  'flight_update',
  'room_assignment',
  'announcement',
  'checkin_reminder'
);

-- Home feed
create type feed_location as enum ('main', 'sidebar');
