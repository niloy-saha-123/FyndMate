/**
 * @file client/src/utils/timeFormatting.ts
 * @description Shared time formatting utilities for chat and UI components
 */

/**
 * Format timestamp as relative time (Just now, 5m ago, 2h ago, Yesterday, etc.)
 * @param date - Date string or Date object
 * @param userTimezone - User's timezone (e.g., "America/New_York")
 * @returns Formatted relative time string
 */
export function formatRelativeTime(date: string | Date, userTimezone?: string): string {
  const targetDate = new Date(date);
  
  // Convert to user's timezone if provided
  if (userTimezone) {
    try {
      const utcDate = new Date(targetDate.toLocaleString("en-US", { timeZone: "UTC" }));
      const userDate = new Date(targetDate.toLocaleString("en-US", { timeZone: userTimezone }));
      // Adjust for timezone difference
      const timezoneOffset = userDate.getTime() - utcDate.getTime();
      targetDate.setTime(targetDate.getTime() + timezoneOffset);
    } catch (error) {
      console.warn("Invalid timezone, using local time:", userTimezone);
    }
  }
  
  const now = new Date();
  const diffMs = now.getTime() - targetDate.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffSeconds < 30) return "Just now";
  if (diffMinutes < 1) return "Less than a minute ago";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  
  // For older dates, show month and day
  return targetDate.toLocaleDateString(undefined, { 
    month: "short", 
    day: "numeric" 
  });
}

/**
 * Format timestamp as absolute time (HH:MM AM/PM)
 * @param date - Date string or Date object
 * @param userTimezone - User's timezone
 * @returns Formatted time string
 */
export function formatAbsoluteTime(date: string | Date, userTimezone?: string): string {
  const targetDate = new Date(date);
  
  if (userTimezone) {
    try {
      return targetDate.toLocaleTimeString(undefined, { 
        hour: "2-digit", 
        minute: "2-digit",
        timeZone: userTimezone
      });
    } catch (error) {
      console.warn("Invalid timezone, using local time:", userTimezone);
    }
  }
  
  return targetDate.toLocaleTimeString(undefined, { 
    hour: "2-digit", 
    minute: "2-digit" 
  });
}

/**
 * Format date as section header (Today, Yesterday, Monday, Jan 15, etc.)
 * @param date - Date string or Date object
 * @returns Formatted date string for section headers
 */
export function formatDateSection(date: string | Date): string {
  const targetDate = new Date(date);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  // Reset time parts for comparison
  const targetDateStr = targetDate.toDateString();
  const todayStr = today.toDateString();
  const yesterdayStr = yesterday.toDateString();
  
  if (targetDateStr === todayStr) return "Today";
  if (targetDateStr === yesterdayStr) return "Yesterday";
  
  // This week - show day name
  const oneWeekAgo = new Date(today);
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  
  if (targetDate > oneWeekAgo) {
    return targetDate.toLocaleDateString(undefined, { weekday: "long" });
  }
  
  // Older dates - show month and day
  return targetDate.toLocaleDateString(undefined, { 
    month: "long", 
    day: "numeric" 
  });
}

/**
 * Check if two messages are from the same sender and close in time (burst detection)
 * @param message1 - First message
 * @param message2 - Second message
 * @param thresholdMs - Time threshold in milliseconds (default: 5 minutes)
 * @returns Boolean indicating if messages are in burst
 */
export function areMessagesInBurst(
  message1: { createdAt: string | Date; senderId: string }, 
  message2: { createdAt: string | Date; senderId: string },
  thresholdMs: number = 5 * 60 * 1000
): boolean {
  if (message1.senderId !== message2.senderId) return false;
  
  const time1 = new Date(message1.createdAt).getTime();
  const time2 = new Date(message2.createdAt).getTime();
  const timeDiff = Math.abs(time1 - time2);
  
  return timeDiff <= thresholdMs;
}

/**
 * Group messages by date for section headers
 * @param messages - Array of messages
 * @returns Array of grouped messages with date headers
 */
export function groupMessagesByDate<T extends { createdAt: string | Date }>(
  messages: T[]
): Array<{ type: "date"; date: string } | { type: "message"; data: T }> {
  if (messages.length === 0) return [];
  
  const sortedMessages = [...messages].sort((a, b) => 
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  
  const grouped: Array<{ type: "date"; date: string } | { type: "message"; data: T }> = [];
  let currentDate = "";
  
  for (const message of sortedMessages) {
    const messageDate = formatDateSection(message.createdAt);
    
    if (messageDate !== currentDate) {
      grouped.push({ type: "date", date: messageDate });
      currentDate = messageDate;
    }
    
    grouped.push({ type: "message", data: message });
  }
  
  return grouped;
}