-- Add Failed state to TransazioneStato enum
ALTER TYPE "TransazioneStato" ADD VALUE IF NOT EXISTS 'Failed';
