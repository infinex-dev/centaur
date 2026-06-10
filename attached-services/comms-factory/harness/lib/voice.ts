import { CREAM_OF_THE_CROP_VOICE, defaultBeatsForKind as creamDefaultBeats } from '@pipeline/voice/cream';
import { INFINEX_VOICE, defaultBeatsForKind as infinexDefaultBeats } from '@pipeline/voice/infinex';
import { NIGEL_VOICE, defaultBeatsForKind as nigelDefaultBeats } from '@pipeline/voice/nigel';
import { PROJECTJIN_VOICE, defaultBeatsForKind as projectjinDefaultBeats } from '@pipeline/voice/projectjin';
import type { VoiceName } from './types';
import type { CharacterSpec, TempoBeat } from '@pipeline/voice/types';

export function voiceSpecFor(voice: VoiceName): CharacterSpec {
  switch (voice) {
    case 'cream':
      return CREAM_OF_THE_CROP_VOICE;
    case 'projectjin':
      return PROJECTJIN_VOICE;
    case 'nigel':
      return NIGEL_VOICE;
    case 'infinex':
    default:
      return INFINEX_VOICE;
  }
}

export function defaultBeatsForVoice(voice: VoiceName): (kind: string) => TempoBeat[] {
  switch (voice) {
    case 'cream':
      return creamDefaultBeats;
    case 'projectjin':
      return projectjinDefaultBeats;
    case 'nigel':
      return nigelDefaultBeats;
    case 'infinex':
    default:
      return infinexDefaultBeats;
  }
}
