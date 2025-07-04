/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The nobody.network Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Room } from "matrix-js-sdk/src/matrix";

import { type RoomEchoChamber } from "./RoomEchoChamber";
import { EchoStore } from "./EchoStore";

/**
 * Semantic access to local echo
 */
export class EchoChamber {
    private constructor() {}

    public static forRoom(room: Room): RoomEchoChamber {
        return EchoStore.instance.getOrCreateChamberForRoom(room);
    }
}
