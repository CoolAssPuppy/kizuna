/**
 * Centralized SELECT column lists used by app queries.
 */
export const SELECT_EVENTS_BASE =
  'id,name,slug,type,start_date,end_date,location,timezone,is_active,hero_image_url,registration_opens_at,registration_closes_at,created_at,updated_at';

export const SELECT_FEED_ITEMS_BASE =
  'id,event_id,title,summary,body,image_path,cta_label,cta_url,location,position,is_published,publish_at,expires_at,created_by,created_at,updated_at';

export const SELECT_DOCUMENTS_BASE =
  'id,event_id,document_key,version,title,content_type,body,pdf_path,applies_to,requires_acknowledgement,requires_scroll,notion_page_id,notion_url,notion_synced_at,display_order,is_active,published_at';

export const SELECT_SESSIONS_BASE =
  'id,event_id,title,description,track,format,speaker_name,speaker_email,starts_at,ends_at,room,capacity,tags,is_mandatory,created_at,updated_at';

export const SELECT_GUEST_INVITATIONS_BASE =
  'id,sponsor_id,guest_user_id,guest_email,first_name,last_name,age_bracket,status,fee_amount,token_hash,token_expires_at,sent_at,accepted_at,cancelled_at,created_at,updated_at';

export const SELECT_ADDITIONAL_GUESTS_BASE =
  'id,sponsor_id,first_name,last_name,age_bracket,fee_amount,is_submitted,submitted_at,created_at,updated_at';
