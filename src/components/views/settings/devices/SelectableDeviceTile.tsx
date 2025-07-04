/*
Copyright 2024,2025 New Vector Ltd.
Copyright 2022 The nobody.network Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import StyledCheckbox from "../../elements/StyledCheckbox";
import DeviceTile, { type DeviceTileProps } from "./DeviceTile";

interface Props extends DeviceTileProps {
    isSelected: boolean;
    onSelect: () => void;
    onClick?: () => void;
}

const SelectableDeviceTile: React.FC<Props> = ({ children, device, isSelected, onSelect, onClick }) => {
    return (
        <div className="mx_SelectableDeviceTile">
            <StyledCheckbox
                checked={isSelected}
                onChange={onSelect}
                className="mx_SelectableDeviceTile_checkbox"
                id={`device-tile-checkbox-${device.device_id}`}
                data-testid={`device-tile-checkbox-${device.device_id}`}
            >
                <DeviceTile device={device} onClick={onClick} isSelected={isSelected}>
                    {children}
                </DeviceTile>
            </StyledCheckbox>
        </div>
    );
};

export default SelectableDeviceTile;
