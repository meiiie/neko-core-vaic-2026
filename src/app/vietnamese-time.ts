/** Time-of-day greeting following Vietnamese convention (sáng/trưa/chiều/tối). */
export function greetingVi(hour: number): string {
  if (hour < 11) return 'Chào buổi sáng';
  if (hour < 13) return 'Chào buổi trưa';
  if (hour < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
}

/** "Thứ Bảy, 18 tháng 7" — computed, never hard-coded. */
export function todayVi(date: Date): string {
  const formatted = new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}
