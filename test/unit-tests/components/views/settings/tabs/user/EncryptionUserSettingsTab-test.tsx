/*
 * Copyright 2024 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { act, render, screen } from "jest-matrix-react";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import { waitFor } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { CryptoEvent } from "matrix-js-sdk/src/crypto-api";

import {
    EncryptionUserSettingsTab,
    type State,
} from "../../../../../../../src/components/views/settings/tabs/user/EncryptionUserSettingsTab";
import { createTestClient, withClientContextRenderOptions } from "../../../../../../test-utils";
import Modal from "../../../../../../../src/Modal";

describe("<EncryptionUserSettingsTab />", () => {
    let matrixClient: MatrixClient;

    beforeEach(() => {
        matrixClient = createTestClient();
        jest.spyOn(matrixClient.getCrypto()!, "isCrossSigningReady").mockResolvedValue(true);
        // Recovery key is available
        jest.spyOn(matrixClient.secretStorage, "getDefaultKeyId").mockResolvedValue("default key");
        // Secrets are cached
        jest.spyOn(matrixClient.getCrypto()!, "getCrossSigningStatus").mockResolvedValue({
            privateKeysInSecretStorage: true,
            publicKeysOnDevice: true,
            privateKeysCachedLocally: {
                masterKey: true,
                selfSigningKey: true,
                userSigningKey: true,
            },
        });
    });

    function renderComponent(props: { initialState?: State } = {}) {
        return render(<EncryptionUserSettingsTab {...props} />, withClientContextRenderOptions(matrixClient));
    }

    it("should display a loading state when the encryption state is computed", () => {
        jest.spyOn(matrixClient.getCrypto()!, "isCrossSigningReady").mockImplementation(() => new Promise(() => {}));

        renderComponent();
        expect(screen.getByLabelText("Loading…")).toBeInTheDocument();
    });

    it("should display a verify button when the encryption is not set up", async () => {
        const user = userEvent.setup();
        jest.spyOn(matrixClient.getCrypto()!, "isCrossSigningReady").mockResolvedValue(false);

        const { asFragment } = renderComponent();
        await waitFor(() =>
            expect(
                screen.getByText("You need to verify this device in order to view your encryption settings."),
            ).toBeInTheDocument(),
        );
        expect(asFragment()).toMatchSnapshot();

        const spy = jest.spyOn(Modal, "createDialog").mockReturnValue({ finished: new Promise(() => {}) } as any);
        await user.click(screen.getByText("Verify this device"));
        expect(spy).toHaveBeenCalled();
    });

    it("should display the recovery panel when key storage is enabled", async () => {
        jest.spyOn(matrixClient.getCrypto()!, "getActiveSessionBackupVersion").mockResolvedValue("1");
        renderComponent();
        await waitFor(() => expect(screen.getByText("Recovery")).toBeInTheDocument());
    });

    it("should not display the recovery panel when key storage is not enabled", async () => {
        jest.spyOn(matrixClient.getCrypto()!, "getKeyBackupInfo").mockResolvedValue(null);
        jest.spyOn(matrixClient.getCrypto()!, "getActiveSessionBackupVersion").mockResolvedValue(null);
        renderComponent();
        await expect(screen.queryByText("Recovery")).not.toBeInTheDocument();
    });

    it("should display the recovery out of sync panel when secrets are not cached", async () => {
        jest.spyOn(matrixClient.getCrypto()!, "getActiveSessionBackupVersion").mockResolvedValue("1");
        // Secrets are not cached
        jest.spyOn(matrixClient.getCrypto()!, "getCrossSigningStatus").mockResolvedValue({
            privateKeysInSecretStorage: true,
            publicKeysOnDevice: true,
            privateKeysCachedLocally: {
                masterKey: false,
                selfSigningKey: true,
                userSigningKey: true,
            },
        });

        const user = userEvent.setup();
        const { asFragment } = renderComponent();

        await waitFor(() => screen.getByRole("button", { name: "Enter recovery key" }));
        expect(asFragment()).toMatchSnapshot();

        await user.click(screen.getByRole("button", { name: "Forgot recovery key?" }));
        expect(
            screen.getByRole("heading", { name: "Forgot your recovery key? You’ll need to reset your identity." }),
        ).toBeVisible();
    });

    it("should display the change recovery key panel when the user clicks on the change recovery button", async () => {
        jest.spyOn(matrixClient.getCrypto()!, "getActiveSessionBackupVersion").mockResolvedValue("1");
        const user = userEvent.setup();

        const { asFragment } = renderComponent();
        await waitFor(() => {
            const button = screen.getByRole("button", { name: "Change recovery key" });
            expect(button).toBeInTheDocument();
            user.click(button);
        });
        await waitFor(() => expect(screen.getByText("Change recovery key")).toBeInTheDocument());
        expect(asFragment()).toMatchSnapshot();
    });

    it("should display the set up recovery key when the user clicks on the set up recovery key button", async () => {
        jest.spyOn(matrixClient.getCrypto()!, "getActiveSessionBackupVersion").mockResolvedValue("1");
        jest.spyOn(matrixClient.secretStorage, "getDefaultKeyId").mockResolvedValue(null);
        const user = userEvent.setup();

        const { asFragment } = renderComponent();
        await waitFor(() => {
            const button = screen.getByRole("button", { name: "Set up recovery" });
            expect(button).toBeInTheDocument();
            user.click(button);
        });
        await waitFor(() => expect(screen.getByText("Set up recovery")).toBeInTheDocument());
        expect(asFragment()).toMatchSnapshot();
    });

    it("should display the reset identity panel when the user clicks on the reset cryptographic identity panel", async () => {
        jest.spyOn(matrixClient.getCrypto()!, "getActiveSessionBackupVersion").mockResolvedValue("1");

        const user = userEvent.setup();

        const { asFragment } = renderComponent();
        await waitFor(() => {
            const button = screen.getByRole("button", { name: "Reset cryptographic identity" });
            expect(button).toBeInTheDocument();
            user.click(button);
        });
        await waitFor(() =>
            expect(screen.getByText("Are you sure you want to reset your identity?")).toBeInTheDocument(),
        );
        expect(asFragment()).toMatchSnapshot();
    });

    it("should enter 'Forgot recovery' flow when initialState is set to 'reset_identity_forgot'", async () => {
        jest.spyOn(matrixClient.getCrypto()!, "getActiveSessionBackupVersion").mockResolvedValue("1");

        renderComponent({ initialState: "reset_identity_forgot" });

        expect(
            await screen.findByRole("heading", {
                name: "Forgot your recovery key? You’ll need to reset your identity.",
            }),
        ).toBeVisible();
    });

    it("should do 'Failed to sync' reset flow when initialState is set to 'reset_identity_sync_failed'", async () => {
        jest.spyOn(matrixClient.getCrypto()!, "getActiveSessionBackupVersion").mockResolvedValue("1");

        renderComponent({ initialState: "reset_identity_sync_failed" });

        expect(
            await screen.findByRole("heading", {
                name: "Failed to sync key storage. You need to reset your identity.",
            }),
        ).toBeVisible();
    });

    it("should update when key backup status event is fired", async () => {
        jest.spyOn(matrixClient.getCrypto()!, "getActiveSessionBackupVersion").mockResolvedValue("1");

        renderComponent();

        await expect(await screen.findByRole("heading", { name: "Recovery" })).toBeVisible();

        jest.spyOn(matrixClient.getCrypto()!, "getActiveSessionBackupVersion").mockResolvedValue(null);

        act(() => {
            matrixClient.emit(CryptoEvent.KeyBackupStatus, false);
        });

        await waitFor(() => {
            expect(screen.queryByRole("heading", { name: "Recovery" })).toBeNull();
        });
    });

    it("should re-check the encryption state and displays the correct panel when the user clicks cancel the reset identity flow", async () => {
        const user = userEvent.setup();

        jest.spyOn(matrixClient.getCrypto()!, "getActiveSessionBackupVersion").mockResolvedValue("1");

        // Secrets are not cached
        jest.spyOn(matrixClient.getCrypto()!, "getCrossSigningStatus").mockResolvedValue({
            privateKeysInSecretStorage: true,
            publicKeysOnDevice: true,
            privateKeysCachedLocally: {
                masterKey: false,
                selfSigningKey: true,
                userSigningKey: true,
            },
        });

        renderComponent({ initialState: "reset_identity_forgot" });

        expect(
            screen.getByRole("heading", { name: "Forgot your recovery key? You’ll need to reset your identity." }),
        ).toBeVisible();

        await user.click(screen.getByRole("button", { name: "Back" }));
        await waitFor(() =>
            screen.getByText("Your key storage is out of sync. Click one of the buttons below to fix the problem."),
        );
    });
});
