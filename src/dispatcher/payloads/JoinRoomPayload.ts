/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The nobody.network Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type JoinedRoom as JoinedRoomEvent } from "@matrix-org/analytics-events/types/typescript/JoinedRoom";
import { type IJoinRoomOpts } from "matrix-js-sdk/src/matrix";

import { type ActionPayload } from "../payloads";
import { type Action } from "../actions";

/* eslint-disable camelcase */
export interface JoinRoomPayload extends Pick<ActionPayload, "action"> {
    action: Action.JoinRoom;

    roomId: string;
    opts?: IJoinRoomOpts;

    // additional parameters for the purpose of metrics & instrumentation
    metricsTrigger: JoinedRoomEvent["trigger"];

    canAskToJoin?: boolean;
}
/* eslint-enable camelcase */
