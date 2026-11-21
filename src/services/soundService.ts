import { NativeModules, Platform } from 'react-native';

const { SoundModule } = NativeModules;

/**
 * Play WhatsApp-like outgoing message sound when a user sends a message.
 */
export const playSentSound = () => {
  try {
    if (SoundModule?.playSentSound) {
      SoundModule.playSentSound();
    }
  } catch (error) {
    console.warn('Could not play sent sound:', error);
  }
};

/**
 * Play WhatsApp-like incoming message sound when a new message is received in the chat.
 */
export const playReceivedSound = () => {
  try {
    if (SoundModule?.playReceivedSound) {
      SoundModule.playReceivedSound();
    }
  } catch (error) {
    console.warn('Could not play received sound:', error);
  }
};
