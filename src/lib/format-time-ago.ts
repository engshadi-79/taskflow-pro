export function timeAgo(dateString: string): string {
  const date = new Date(dateString);
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);

  if (diffMin < 1) return "الآن";
  if (diffMin < 60) return `قبل ${diffMin} دقيقة`;

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `قبل ${diffHour} ساعة`;

  const diffDay = Math.floor(diffHour / 24);
  if (diffDay === 1) return "أمس";
  if (diffDay < 7) return `قبل ${diffDay} أيام`;

  return date.toLocaleDateString("ar");
}
