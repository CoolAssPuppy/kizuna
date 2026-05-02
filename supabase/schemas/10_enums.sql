-- Shared enum types
--
-- Defined once here so every reference in the schema below is type-safe and
-- consistent. Adding a value: `alter type <name> add value '<new>';` (cannot
-- remove or rename safely without rebuilding dependent tables).

-- Identity and access
-- 'dependent' is a synthetic role for under-18 additional_guests. The
-- row in public.users is a shadow with no matching auth.users entry —
-- the sponsor (and the sponsor's adult guests) write the dependent's
-- profile data through the standard sections, but the dependent never
-- signs in. RLS routes those writes through sponsor identity.
create type user_role as enum ('employee', 'guest', 'admin', 'super_admin', 'dependent');
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
-- Lifecycle: pending (row added, sponsor has not paid) -> sent (sponsor
-- paid the bundled fees and the invite email is out) -> accepted (guest
-- followed the link, set a password, signed in). expired/cancelled are
-- terminal admin states. We do NOT send the invite email until the
-- sponsor pays — that's the gate between pending and sent.
create type guest_invitation_status as enum ('pending', 'sent', 'accepted', 'expired', 'cancelled');
-- Pricing tiers for the Invite-a-Guest flow.
--   under_12 -> $200, teen (12-17) -> $500, adult (18+) -> $950.
-- 18+ guests get their own login + email; under 18 are admin-managed
-- riders on the sponsor's registration.
create type guest_age_bracket as enum ('under_12', 'teen', 'adult');

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
