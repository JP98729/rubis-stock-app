"use client";

import { GREEN, GREEN_DARK, AMBER } from "@/lib/brand";
import { buildMonthGrid, deliveryWeekday, WEEKDAY_NAME } from "@/lib/utils";

/**
 * `today` is always supplied by the server ("YYYY-MM-DD") so server and client
 * render the same calendar — no hydration mismatch across a midnight boundary.
 */
function parseToday(today: string) {
  const [y, m, d] = today.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function nextDeliveryFrom(now: Date) {
  let d = new Date(now.getFullYear(), now.getMonth(), 23);
  if (now.getDate() > 23) d = new Date(now.getFullYear(), now.getMonth() + 1, 23);
  return d;
}

export function DeliveryBanner({ today }: { today: string }) {
  const now = parseToday(today);
  const next = nextDeliveryFrom(now);
  const diff = Math.round((next.getTime() - now.getTime()) / 86400000);
  const label =
    diff === 0 ? "Delivery day is today!" : diff === 1 ? "Delivery tomorrow" : `${diff} days to next delivery`;
  return (
    <div className="rounded-xl px-4 py-2.5 flex items-center justify-between text-sm" style={{ background: "#EEF7DE" }}>
      <span className="font-semibold" style={{ color: GREEN_DARK }}>
        {label}
      </span>
      <span className="text-xs text-gray-500">
        {next.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
      </span>
    </div>
  );
}

export function DeliveryCalendar({ today }: { today: string }) {
  const now = parseToday(today);
  const months: Date[] = [];
  for (let i = 0; i < 6; i++) months.push(new Date(now.getFullYear(), now.getMonth() + i, 1));
  return (
    <div className="flex flex-col gap-4">
      <DeliveryBanner today={today} />
      <div className="text-xs text-gray-400 px-1">
        One countrywide delivery run per month, on the 23rd, to every active branch. Highlighted below across the next 6
        months.
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {months.map((m) => {
          const year = m.getFullYear();
          const monthIdx = m.getMonth();
          const weeks = buildMonthGrid(year, monthIdx);
          const wd = deliveryWeekday(year, monthIdx);
          const isWeekend = wd === "Sat" || wd === "Sun";
          return (
            <div key={`${year}-${monthIdx}`} className="bg-white rounded-xl border border-gray-200 p-3">
              <div className="font-semibold text-sm mb-2">
                {m.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
              </div>
              <table className="w-full text-center text-xs">
                <thead>
                  <tr className="text-gray-400">
                    {WEEKDAY_NAME.map((d) => (
                      <th key={d} className="font-medium pb-1">
                        {d}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {weeks.map((week, wi) => (
                    <tr key={wi}>
                      {week.map((d, di) => (
                        <td key={di} className="py-0.5">
                          {d === 0 ? (
                            ""
                          ) : (
                            <span
                              className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${
                                d === 23 ? "text-white font-bold" : "text-gray-600"
                              }`}
                              style={d === 23 ? { background: GREEN } : {}}
                            >
                              {d}
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {isWeekend && (
                <div className="text-[11px] mt-1" style={{ color: AMBER }}>
                  23rd falls on a {wd === "Sat" ? "Saturday" : "Sunday"}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
