package com.chattingapp;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.SoundPool;
import android.media.ToneGenerator;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

public class SoundModule extends ReactContextBaseJavaModule {
    private SoundPool soundPool;
    private int sentSoundId = 0;
    private int receivedSoundId = 0;
    private boolean sentLoaded = false;
    private boolean receivedLoaded = false;

    public SoundModule(ReactApplicationContext reactContext) {
        super(reactContext);
        try {
            AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();

            soundPool = new SoundPool.Builder()
                .setMaxStreams(4)
                .setAudioAttributes(audioAttributes)
                .build();

            soundPool.setOnLoadCompleteListener(new SoundPool.OnLoadCompleteListener() {
                @Override
                public void onLoadComplete(SoundPool pool, int sampleId, int status) {
                    if (status == 0) {
                        if (sampleId == sentSoundId) sentLoaded = true;
                        if (sampleId == receivedSoundId) receivedLoaded = true;
                    }
                }
            });

            Context ctx = reactContext.getApplicationContext();
            int sentRes = ctx.getResources().getIdentifier("message_sent", "raw", ctx.getPackageName());
            if (sentRes != 0) {
                sentSoundId = soundPool.load(ctx, sentRes, 1);
            }
            int recvRes = ctx.getResources().getIdentifier("message_received", "raw", ctx.getPackageName());
            if (recvRes != 0) {
                receivedSoundId = soundPool.load(ctx, recvRes, 1);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @Override
    public String getName() {
        return "SoundModule";
    }

    @ReactMethod
    public void playSentSound() {
        try {
            if (sentLoaded && soundPool != null) {
                soundPool.play(sentSoundId, 0.45f, 0.45f, 1, 0, 1.0f);
            } else if (sentSoundId != 0 && soundPool != null) {
                int streamId = soundPool.play(sentSoundId, 0.45f, 0.45f, 1, 0, 1.0f);
                if (streamId == 0) {
                    ToneGenerator tone = new ToneGenerator(AudioManager.STREAM_NOTIFICATION, 40);
                    tone.startTone(ToneGenerator.TONE_PROP_PROMPT, 40);
                }
            } else {
                ToneGenerator tone = new ToneGenerator(AudioManager.STREAM_NOTIFICATION, 40);
                tone.startTone(ToneGenerator.TONE_PROP_PROMPT, 40);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @ReactMethod
    public void playReceivedSound() {
        try {
            if (receivedLoaded && soundPool != null) {
                soundPool.play(receivedSoundId, 1.0f, 1.0f, 1, 0, 1.0f);
            } else if (receivedSoundId != 0 && soundPool != null) {
                int streamId = soundPool.play(receivedSoundId, 1.0f, 1.0f, 1, 0, 1.0f);
                if (streamId == 0) {
                    ToneGenerator tone = new ToneGenerator(AudioManager.STREAM_NOTIFICATION, 80);
                    tone.startTone(ToneGenerator.TONE_PROP_BEEP, 120);
                }
            } else {
                ToneGenerator tone = new ToneGenerator(AudioManager.STREAM_NOTIFICATION, 80);
                tone.startTone(ToneGenerator.TONE_PROP_BEEP, 120);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
