// Shared numbers for the chart, scoring and data. A curve is 120 monthly values (Jan 2016 to Dec 2025),
// scaled so its highest month is 100, like Google Trends. Guesses are 40 quarterly values.
export const MONTHS = 120;
export const QUARTERS = 40;
export const ROUNDS = 5;
export const START_YEAR = 2016;

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const monthLabel = (m: number) => {
  const r = Math.round(m);
  return `${MON[r % 12]} ${START_YEAR + Math.floor(r / 12)}`;
};
