/**
 * @file client/src/utils/messageGrouping.ts
 * @description Utilities for grouping and optimizing chat message display
 */

import { areMessagesInBurst } from "./timeFormatting";

/**
 * Interface for message grouping result
 */
interface GroupedMessage<T> {
  type: "message";
  data: T;
  showTimestamp: boolean;
  isFirstInSequence: boolean;
  isLastInSequence: boolean;
}

interface DateHeader {
  type: "date";
  date: string;
}

/**
 * Group messages with burst detection and timestamp optimization
 * @param messages - Array of messages sorted chronologically
 * @param formatDateSection - Function to format date headers
 * @returns Array of grouped items with display metadata
 */
export function groupMessagesWithBurstOptimization<T extends { 
  createdAt: string | Date; 
  senderId: string 
}>(
  messages: T[],
  formatDateSection: (date: string | Date) => string
): Array<DateHeader | GroupedMessage<T>> {
  if (messages.length === 0) return [];

  const grouped: Array<DateHeader | GroupedMessage<T>> = [];
  let currentDate = "";

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    const messageDate = formatDateSection(message.createdAt);
    
    // Add date header if new date
    if (messageDate !== currentDate) {
      grouped.push({ type: "date", date: messageDate });
      currentDate = messageDate;
    }
    
    // Determine burst sequence boundaries
    const previousMessage = i > 0 ? messages[i - 1] : null;
    const nextMessage = i < messages.length - 1 ? messages[i + 1] : null;
    
    const isFirstInSequence = !previousMessage || 
      !areMessagesInBurst(previousMessage, message);
    
    const isLastInSequence = !nextMessage || 
      !areMessagesInBurst(message, nextMessage);
    
    // Show timestamp only on last message of burst sequence
    const showTimestamp = isLastInSequence;
    
    grouped.push({
      type: "message",
      data: message,
      showTimestamp,
      isFirstInSequence,
      isLastInSequence
    });
  }
  
  return grouped;
}

/**
 * Get message sequence information for display optimization
 * @param messages - Array of messages
 * @param currentIndex - Current message index
 * @returns Object with sequence information
 */
export function getMessageSequenceInfo<T extends { 
  createdAt: string | Date; 
  senderId: string 
}>(
  messages: T[],
  currentIndex: number
) {
  const currentMessage = messages[currentIndex];
  const previousMessage = currentIndex > 0 ? messages[currentIndex - 1] : null;
  const nextMessage = currentIndex < messages.length - 1 ? messages[currentIndex + 1] : null;
  
  const isFirstInSequence = !previousMessage || 
    !areMessagesInBurst(previousMessage, currentMessage);
  
  const isLastInSequence = !nextMessage || 
    !areMessagesInBurst(currentMessage, nextMessage);
  
  const showTimestamp = isLastInSequence;
  const showAvatar = isFirstInSequence;
  const showSenderName = isFirstInSequence;
  
  return {
    isFirstInSequence,
    isLastInSequence,
    showTimestamp,
    showAvatar,
    showSenderName
  };
}