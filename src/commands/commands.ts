/// <reference types="office-js" />

/**
 * The commands entry point.
 *
 * Office loads this file for the Smart Alerts runtime. It binds
 * our handler to the name used in the manifest.
 */

import { onMessageSendHandler } from "../office/sendHandler";

// Office.onReady returns a promise we do not need to await here.
void Office.onReady(() => {
  Office.actions.associate("onMessageSendHandler", (event) => {
    void onMessageSendHandler(event as Office.AddinCommands.Event);
  });
});
