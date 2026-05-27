// Static imports of every skill's in-game dialogue, so the JSON is bundled
// into the serverless function (no runtime fs read — survives Vercel tracing).
import authority from "@/skills/authority.json";
import composure from "@/skills/composure.json";
import conceptualization from "@/skills/conceptualization.json";
import drama from "@/skills/drama.json";
import electrochemistry from "@/skills/electrochemistry.json";
import empathy from "@/skills/empathy.json";
import encyclopedia from "@/skills/encyclopedia.json";
import endurance from "@/skills/endurance.json";
import esprit_de_corps from "@/skills/esprit_de_corps.json";
import half_light from "@/skills/half_light.json";
import hand_eye_coordination from "@/skills/hand_eye_coordination.json";
import inland_empire from "@/skills/inland_empire.json";
import interfacing from "@/skills/interfacing.json";
import logic from "@/skills/logic.json";
import pain_threshold from "@/skills/pain_threshold.json";
import perception from "@/skills/perception.json";
import physical_instrument from "@/skills/physical_instrument.json";
import reaction_speed from "@/skills/reaction_speed.json";
import rhetoric from "@/skills/rhetoric.json";
import savoir_faire from "@/skills/savoir_faire.json";
import shivers from "@/skills/shivers.json";
import suggestion from "@/skills/suggestion.json";
import visual_calculus from "@/skills/visual_calculus.json";
import volition from "@/skills/volition.json";

export interface DialogueLine {
  text: string;
}
interface DialogueFile {
  lines: DialogueLine[];
}

// Keyed by the file basename (SKILL_FILE_MAP values).
export const DIALOGUE: Record<string, DialogueFile> = {
  authority,
  composure,
  conceptualization,
  drama,
  electrochemistry,
  empathy,
  encyclopedia,
  endurance,
  esprit_de_corps,
  half_light,
  hand_eye_coordination,
  inland_empire,
  interfacing,
  logic,
  pain_threshold,
  perception,
  physical_instrument,
  reaction_speed,
  rhetoric,
  savoir_faire,
  shivers,
  suggestion,
  visual_calculus,
  volition,
};
