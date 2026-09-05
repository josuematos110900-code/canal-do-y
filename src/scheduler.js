import { schedule, utcOffsetHours } from "./config.js";
import { scheduledSlots } from "./db.js";

const DAY_NAMES = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

/**
 * Devolve o próximo horário de publicação livre (ISO 8601, UTC), respeitando:
 *  - os dias da semana configurados (config/schedule.json → days)
 *  - a hora configurada (publish_time, na timezone configurada)
 *  - os slots já ocupados na base de dados (nunca dois vídeos no mesmo horário)
 *  - nunca devolve uma data no passado
 */
export function nextAvailableSlot(afterDate = new Date(), extraOccupied = []) {
  const wantedDays = new Set(schedule.days.map((d) => d.toUpperCase()));
  const [hh, mm] = schedule.publish_time.split(":").map(Number);
  const offset = utcOffsetHours();
  const occupied = new Set([...scheduledSlots(), ...extraOccupied]);

  // Começa a procurar a partir de "agora" (ou depois do último slot conhecido,
  // o que for mais tarde), em passos de um dia civil na timezone do canal.
  let cursorUtc = new Date(Math.max(afterDate.getTime(), Date.now()));

  for (let i = 0; i < 366; i++) {
    // Data civil no fuso do canal para o dia do cursor.
    const localMs = cursorUtc.getTime() + offset * 3600 * 1000;
    const local = new Date(localMs);
    const dayName = DAY_NAMES[local.getUTCDay()];

    if (wantedDays.has(dayName)) {
      const candidateLocal = new Date(Date.UTC(
        local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), hh, mm, 0
      ));
      const candidateUtc = new Date(candidateLocal.getTime() - offset * 3600 * 1000);
      const iso = candidateUtc.toISOString();

      if (candidateUtc.getTime() > Date.now() && !occupied.has(iso)) {
        return iso;
      }
    }

    cursorUtc = new Date(cursorUtc.getTime() + 24 * 3600 * 1000);
  }

  throw new Error("Não foi possível encontrar um slot de publicação nos próximos 366 dias.");
}

/** Calcula N slots consecutivos livres, na ordem em que os vídeos devem ser publicados. */
export function nextAvailableSlots(count) {
  const slots = [];
  const after = new Date();
  for (let i = 0; i < count; i++) {
    const iso = nextAvailableSlot(after, slots);
    slots.push(iso);
  }
  return slots;
}
