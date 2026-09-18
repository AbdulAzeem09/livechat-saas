-- Email as a real messaging channel: customers write to a support address and the
-- replies thread back, the same way WhatsApp and Messenger conversations work.
ALTER TYPE "messaging_channel" ADD VALUE IF NOT EXISTS 'EMAIL';
