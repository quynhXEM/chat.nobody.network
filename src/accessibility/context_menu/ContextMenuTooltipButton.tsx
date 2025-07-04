/*
Copyright 2024 New Vector Ltd.
Copyright 2019 The nobody.network Foundation C.I.C.
Copyright 2018 New Vector Ltd
Copyright 2015, 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";

import AccessibleButton, { type ButtonProps } from "../../components/views/elements/AccessibleButton";

type Props<T extends keyof HTMLElementTagNameMap> = ButtonProps<T> & {
    // whether the context menu is currently open
    isExpanded: boolean;
};

// Semantic component for representing the AccessibleButton which launches a <ContextMenu />
export const ContextMenuTooltipButton = function <T extends keyof HTMLElementTagNameMap>({
    isExpanded,
    children,
    onClick,
    onContextMenu,
    ref,
    ...props
}: Props<T>): JSX.Element {
    return (
        <AccessibleButton
            {...props}
            onClick={onClick}
            onContextMenu={onContextMenu ?? onClick ?? undefined}
            aria-haspopup={true}
            aria-expanded={isExpanded}
            disableTooltip={isExpanded}
            ref={ref}
        >
            {children}
        </AccessibleButton>
    );
};
