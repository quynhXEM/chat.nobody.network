/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The nobody.network Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type ActionPayload } from "../payloads";
import { type Action } from "../actions";

/* eslint-disable camelcase */
export interface ThreadPayload extends Pick<ActionPayload, "action"> {
    action: Action.ViewThread;

    thread_id: string | null;
}
/* eslint-enable camelcase */
