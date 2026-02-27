/**
 * @file client/src/utils/timeFormatting.ts
 * @description Utility functions for relative time formatting and timezone conversion
 */

/**
 * Convert UTC time to receiver's local timezone
 * @param utcTimeString ISO string in UTC
 * @returns Date object in local timezone
 */
export function convertToLocalTime(utcTimeString: string): Date {
  return new Date(utcTimeString);
}

/**
 * Format time relatively (Just now, 5m ago, 2h ago, etc.)
 * @param date Date object in receiver's local timezone
 * @returns Formatted relative time string
 */
export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 10) {
    return 'Just now';
  } else if (diffSeconds < 60) {
    return `${diffSeconds}s ago`;
  } else if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    // Format as MMM D (e.g., Jan 15)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}

/**
 * Format date as section header (Today, Yesterday, or MMM DD, YYYY)
 * @param date Date object
 * @returns Formatted date string for section headers
 */
export function formatDateSection(date: Date): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const dateStr = date.toDateString();
  const todayStr = today.toDateString();
  const yesterdayStr = yesterday.toDateString();

  if (dateStr === todayStr) {
    return 'Today';
  } else if (dateStr === yesterdayStr) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    });
  }
}

/**
 * Check if a message is the last in a burst from the same sender
 * A burst is defined as consecutive messages from the same sender within 5 minutes
 * @param messages Array of all messages
 * @param currentIndex Index of current message
 * @returns True if this message should show a timestamp
 */
export function isLastInBurst(messages: Array<{id: string, senderId: string, createdAt: string}>, currentIndex: number): boolean {
  const currentMessage = messages[currentIndex];
  const currentSender = currentMessage.senderId;
  const currentCreatedAt = new Date(currentMessage.createdAt);
  
  // If this is the last message overall, show timestamp
  if (currentIndex === messages.length - 1) {
    return true;
  }
  
  const nextMessage = messages[currentIndex + 1];
  const nextSender = nextMessage.senderId;
  const nextCreatedAt = new Date(nextMessage.createdAt);
  
  // If sender changes, this is the last in burst
  if (currentSender !== nextSender) {
    return true;
  }
  
  // If gap to next message is > 5 minutes, this is the last in burst
  const gapMs = nextCreatedAt.getTime() - currentCreatedAt.getTime();
  const gapMinutes = gapMs / (1000 * 60);
  
  return gapMinutes > 5;
}

/**
 * Format time for message timestamps (HH:MM AM/PM)
 * @param date Date object
 * @returns Formatted time string
 */
export function formatMessageTime(date: Date): string {
  return date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}