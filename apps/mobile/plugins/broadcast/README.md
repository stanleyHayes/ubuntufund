# iOS broadcast transport

Swift sources are the Apache-2.0 licensed Jitsi screen-share sample at commit
`18c35f7625b38233579ff34f761f4c126ba7e03a`, referenced by LiveKit's React Native SDK:
https://github.com/jitsi/jitsi-meet-sdk-samples/tree/18c35f7625b38233579ff34f761f4c126ba7e03a/ios/swift-screensharing/JitsiSDKScreenSharingTest/Broadcast%20Extension

The accompanying config plugin substitutes the Ujimora app group while copying
the source into the generated iOS project. The sample source is otherwise retained, with trailing whitespace normalized.
It sends ReplayKit video frames through the SDK's `rtc_SSFD` local socket. System/app
audio samples are not transmitted by this sample; microphone narration uses LiveKit.
The app and extension require matching App Group provisioning for physical-device
builds. Native screen broadcasting still requires device acceptance.
