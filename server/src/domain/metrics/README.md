# Operational Capacity

## Sources and flow

`AgendaConfig.slotDuration`, `AgendaConfig.capacityPerSlot`, each active `Professional.workSchedule`, the national holiday calendar, and active `AgendaCalendarEntry` records are inputs to `capacity.service.js`. The service computes theoretical and effective daily capacity, then sums the real days in week/month ranges. Both `/api/capacity` and the capacity fields in `/api/metrics` use these summaries. Appointment rows determine occupied seats; attendance and no-show remain separate measures.

## Calendar policy

`HolidayCalendarService` generates Argentine calendar records by requested year. Only `NATIONAL_HOLIDAY` records close automatically, controlled by `AgendaConfig.nationalHolidaysClose` (default `true`). Optional/non-working tourism days, bank holidays, and observances are returned as distinct informational types and do not close Kareh automatically. `AgendaCalendarEntry` is reserved for manual clinic closures and schedule exceptions; it is not the national holiday store.

Specific-professional calendar entries take precedence over global entries. At one scope, a single schedule exception overrides a closure; contradictory schedule exceptions fail closed. A professional-specific reopening affects only that professional. A global reopening affects professionals without a more-specific closure.

The holiday data comes from the `date-holidays` package (ISC package code; CC BY-SA 3.0 holiday data; see `server/THIRD_PARTY_NOTICES.md`). Verify updates against official Argentine publications before relying on a new year's calendar in production.

## Historical limitation

`AgendaConfig` and `WorkSchedule` are current-state records, not versioned by effective date. Capacity reconstructed for past dates can therefore change when current schedules or policy change. The historical Capacity trend currently compares old appointment activity against current capacity. Correct historical denominators will require configuration versioning or stored capacity snapshots; neither is implemented in this phase.

## Locations

There is no `Location`/`Site` model or `locationId` on professionals, schedules, appointments, or calendar entries. Capacity is therefore clinic-wide and professional-scoped only. If locations are introduced later, `locationId` should join the schedule, exception, appointment, and capacity context at the domain boundary; no partial location support is implied here.
