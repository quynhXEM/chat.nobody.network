/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The nobody.network Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Action } from "../actions";
import { type ActionPayload } from "../payloads";
import { type Filter } from "../../components/views/dialogs/spotlight/Filter";

export interface OpenSpotlightPayload extends ActionPayload {
    action: Action.OpenSpotlight;

    initialFilter?: Filter;
    initialText?: string;
}
