/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The nobody.network Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { fireEvent, render, type RenderResult, screen, waitFor } from "jest-matrix-react";
import {
    EventStatus,
    MatrixEvent,
    Room,
    PendingEventOrdering,
    type BeaconIdentifier,
    Beacon,
    getBeaconInfoIdentifier,
    EventType,
    FeatureSupport,
    Thread,
    M_POLL_KIND_DISCLOSED,
    EventTimeline,
} from "matrix-js-sdk/src/matrix";
import { PollStartEvent } from "matrix-js-sdk/src/extensible_events_v1/PollStartEvent";
import { mocked } from "jest-mock";
import userEvent from "@testing-library/user-event";

import { MatrixClientPeg } from "../../../../../src/MatrixClientPeg";
import { TimelineRenderingType } from "../../../../../src/contexts/RoomContext";
import { type IRoomState } from "../../../../../src/components/structures/RoomView";
import { canEditContent } from "../../../../../src/utils/EventUtils";
import { copyPlaintext, getSelectedText } from "../../../../../src/utils/strings";
import MessageContextMenu from "../../../../../src/components/views/context_menus/MessageContextMenu";
import { makeBeaconEvent, makeBeaconInfoEvent, makeLocationEvent, stubClient } from "../../../../test-utils";
import dispatcher from "../../../../../src/dispatcher/dispatcher";
import SettingsStore from "../../../../../src/settings/SettingsStore";
import { ReadPinsEventId } from "../../../../../src/components/views/right_panel/types";
import { Action } from "../../../../../src/dispatcher/actions";
import { createMessageEventContent } from "../../../../test-utils/events";
import { ScopedRoomContextProvider } from "../../../../../src/contexts/ScopedRoomContext.tsx";

jest.mock("../../../../../src/utils/strings", () => ({
    copyPlaintext: jest.fn(),
    getSelectedText: jest.fn(),
}));
jest.mock("../../../../../src/utils/EventUtils", () => ({
    ...(jest.requireActual("../../../../../src/utils/EventUtils") as object),
    canEditContent: jest.fn(),
}));
jest.mock("../../../../../src/dispatcher/dispatcher");

const roomId = "roomid";

describe("MessageContextMenu", () => {
    beforeEach(() => {
        jest.resetAllMocks();
        stubClient();
    });

    it("does show copy link button when supplied a link", () => {
        const eventContent = createMessageEventContent("hello");
        const props = {
            link: "https://google.com/",
        };
        createMenuWithContent(eventContent, props);
        const copyLinkButton = document.querySelector('a[aria-label="Copy link"]');
        expect(copyLinkButton).toHaveAttribute("href", props.link);
    });

    it("does not show copy link button when not supplied a link", () => {
        const eventContent = createMessageEventContent("hello");
        createMenuWithContent(eventContent);
        const copyLinkButton = document.querySelector('a[aria-label="Copy link"]');
        expect(copyLinkButton).toBeFalsy();
    });

    describe("message pinning", () => {
        let room: Room;

        beforeEach(() => {
            room = makeDefaultRoom();

            jest.spyOn(SettingsStore, "getValue").mockReturnValue(true);
            jest.spyOn(
                room.getLiveTimeline().getState(EventTimeline.FORWARDS)!,
                "mayClientSendStateEvent",
            ).mockReturnValue(true);
        });

        afterAll(() => {
            jest.spyOn(SettingsStore, "getValue").mockRestore();
        });

        it("does not show pin option when user does not have rights to pin", () => {
            const eventContent = createMessageEventContent("hello");
            const event = new MatrixEvent({ type: EventType.RoomMessage, content: eventContent });

            // mock permission to disallow adding pinned messages to room
            jest.spyOn(
                room.getLiveTimeline().getState(EventTimeline.FORWARDS)!,
                "mayClientSendStateEvent",
            ).mockReturnValue(false);

            createMenu(event, { rightClick: true }, {}, undefined, room);

            expect(screen.queryByRole("menuitem", { name: "Pin" })).toBeFalsy();
        });

        it("does not show pin option for beacon_info event", () => {
            const deadBeaconEvent = makeBeaconInfoEvent("@alice:server.org", roomId, { isLive: false });

            createMenu(deadBeaconEvent, { rightClick: true }, {}, undefined, room);

            expect(screen.queryByRole("menuitem", { name: "Pin" })).toBeFalsy();
        });

        it("shows pin option when pinning feature is enabled", () => {
            const eventContent = createMessageEventContent("hello");
            const pinnableEvent = new MatrixEvent({
                type: EventType.RoomMessage,
                content: eventContent,
                room_id: roomId,
            });

            createMenu(pinnableEvent, { rightClick: true }, {}, undefined, room);

            expect(screen.getByRole("menuitem", { name: "Pin" })).toBeTruthy();
        });

        it("pins event on pin option click", async () => {
            const onFinished = jest.fn();
            const eventContent = createMessageEventContent("hello");
            const pinnableEvent = new MatrixEvent({
                type: EventType.RoomMessage,
                content: eventContent,
                room_id: roomId,
            });
            pinnableEvent.event.event_id = "!3";
            const client = MatrixClientPeg.safeGet();

            jest.spyOn(room.getLiveTimeline().getState(EventTimeline.FORWARDS)!, "getStateEvents").mockReturnValue({
                // @ts-ignore
                getContent: () => ({ pinned: ["!1", "!2"] }),
            });

            // mock read pins account data
            const pinsAccountData = new MatrixEvent({ content: { event_ids: ["!1", "!2"] } });
            jest.spyOn(room, "getAccountData").mockReturnValue(pinsAccountData);

            createMenu(pinnableEvent, { onFinished, rightClick: true }, {}, undefined, room);

            await userEvent.click(screen.getByRole("menuitem", { name: "Pin" }));

            // added to account data
            await waitFor(() =>
                expect(client.setRoomAccountData).toHaveBeenCalledWith(roomId, ReadPinsEventId, {
                    event_ids: [
                        // from account data
                        "!1",
                        "!2",
                        pinnableEvent.getId(),
                    ],
                }),
            );

            // add to room's pins
            await waitFor(() =>
                expect(client.sendStateEvent).toHaveBeenCalledWith(
                    roomId,
                    EventType.RoomPinnedEvents,
                    {
                        pinned: ["!1", "!2", pinnableEvent.getId()],
                    },
                    "",
                ),
            );

            expect(onFinished).toHaveBeenCalled();
        });

        it("unpins event on pin option click when event is pinned", async () => {
            const eventContent = createMessageEventContent("hello");
            const pinnableEvent = new MatrixEvent({
                type: EventType.RoomMessage,
                content: eventContent,
                room_id: roomId,
            });
            pinnableEvent.event.event_id = "!3";
            const client = MatrixClientPeg.safeGet();

            // make the event already pinned in the room
            const pinEvent = new MatrixEvent({
                type: EventType.RoomPinnedEvents,
                room_id: roomId,
                state_key: "",
                content: { pinned: [pinnableEvent.getId(), "!another-event"] },
            });
            room.getLiveTimeline().getState(EventTimeline.FORWARDS)!.setStateEvents([pinEvent]);

            // mock read pins account data
            const pinsAccountData = new MatrixEvent({ content: { event_ids: ["!1", "!2"] } });
            jest.spyOn(room, "getAccountData").mockReturnValue(pinsAccountData);

            createMenu(pinnableEvent, { rightClick: true }, {}, undefined, room);

            await userEvent.click(screen.getByRole("menuitem", { name: "Unpin" }));

            expect(client.setRoomAccountData).not.toHaveBeenCalled();

            // add to room's pins
            expect(client.sendStateEvent).toHaveBeenCalledWith(
                roomId,
                EventType.RoomPinnedEvents,
                // pinnableEvent's id removed, other pins intact
                { pinned: ["!another-event"] },
                "",
            );
        });
    });

    describe("message forwarding", () => {
        it("allows forwarding a room message", () => {
            const eventContent = createMessageEventContent("hello");
            createMenuWithContent(eventContent);
            expect(document.querySelector('li[aria-label="Forward"]')).toBeTruthy();
        });

        it("does not allow forwarding a poll", () => {
            const eventContent = PollStartEvent.from("why?", ["42"], M_POLL_KIND_DISCLOSED);
            createMenuWithContent(eventContent);
            expect(document.querySelector('li[aria-label="Forward"]')).toBeFalsy();
        });

        describe("forwarding beacons", () => {
            const aliceId = "@alice:server.org";

            it("does not allow forwarding a beacon that is not live", () => {
                const deadBeaconEvent = makeBeaconInfoEvent(aliceId, roomId, { isLive: false });
                const beacon = new Beacon(deadBeaconEvent);
                const beacons = new Map<BeaconIdentifier, Beacon>();
                beacons.set(getBeaconInfoIdentifier(deadBeaconEvent), beacon);
                createMenu(deadBeaconEvent, {}, {}, beacons);
                expect(document.querySelector('li[aria-label="Forward"]')).toBeFalsy();
            });

            it("does not allow forwarding a beacon that is not live but has a latestLocation", () => {
                const deadBeaconEvent = makeBeaconInfoEvent(aliceId, roomId, { isLive: false });
                const beaconLocation = makeBeaconEvent(aliceId, {
                    beaconInfoId: deadBeaconEvent.getId(),
                    geoUri: "geo:51,41",
                });
                const beacon = new Beacon(deadBeaconEvent);
                // @ts-ignore illegally set private prop
                beacon._latestLocationEvent = beaconLocation;
                const beacons = new Map<BeaconIdentifier, Beacon>();
                beacons.set(getBeaconInfoIdentifier(deadBeaconEvent), beacon);
                createMenu(deadBeaconEvent, {}, {}, beacons);
                expect(document.querySelector('li[aria-label="Forward"]')).toBeFalsy();
            });

            it("does not allow forwarding a live beacon that does not have a latestLocation", () => {
                const beaconEvent = makeBeaconInfoEvent(aliceId, roomId, { isLive: true });

                const beacon = new Beacon(beaconEvent);
                const beacons = new Map<BeaconIdentifier, Beacon>();
                beacons.set(getBeaconInfoIdentifier(beaconEvent), beacon);
                createMenu(beaconEvent, {}, {}, beacons);
                expect(document.querySelector('li[aria-label="Forward"]')).toBeFalsy();
            });

            it("allows forwarding a live beacon that has a location", () => {
                const liveBeaconEvent = makeBeaconInfoEvent(aliceId, roomId, { isLive: true });
                const beaconLocation = makeBeaconEvent(aliceId, {
                    beaconInfoId: liveBeaconEvent.getId(),
                    geoUri: "geo:51,41",
                });
                const beacon = new Beacon(liveBeaconEvent);
                // @ts-ignore illegally set private prop
                beacon._latestLocationEvent = beaconLocation;
                const beacons = new Map<BeaconIdentifier, Beacon>();
                beacons.set(getBeaconInfoIdentifier(liveBeaconEvent), beacon);
                createMenu(liveBeaconEvent, {}, {}, beacons);
                expect(document.querySelector('li[aria-label="Forward"]')).toBeTruthy();
            });

            it("opens forward dialog with correct event", () => {
                const dispatchSpy = jest.spyOn(dispatcher, "dispatch");
                const liveBeaconEvent = makeBeaconInfoEvent(aliceId, roomId, { isLive: true });
                const beaconLocation = makeBeaconEvent(aliceId, {
                    beaconInfoId: liveBeaconEvent.getId(),
                    geoUri: "geo:51,41",
                });
                const beacon = new Beacon(liveBeaconEvent);
                // @ts-ignore illegally set private prop
                beacon._latestLocationEvent = beaconLocation;
                const beacons = new Map<BeaconIdentifier, Beacon>();
                beacons.set(getBeaconInfoIdentifier(liveBeaconEvent), beacon);
                createMenu(liveBeaconEvent, {}, {}, beacons);

                fireEvent.click(document.querySelector('li[aria-label="Forward"]')!);

                // called with forwardableEvent, not beaconInfo event
                expect(dispatchSpy).toHaveBeenCalledWith(
                    expect.objectContaining({
                        event: beaconLocation,
                    }),
                );
            });
        });
    });

    describe("open as map link", () => {
        it("does not allow opening a plain message in open street maps", () => {
            const eventContent = createMessageEventContent("hello");
            createMenuWithContent(eventContent);
            expect(document.querySelector('a[aria-label="Open in OpenStreetMap"]')).toBeFalsy();
        });

        it("does not allow opening a beacon that does not have a shareable location event", () => {
            const deadBeaconEvent = makeBeaconInfoEvent("@alice", roomId, { isLive: false });
            const beacon = new Beacon(deadBeaconEvent);
            const beacons = new Map<BeaconIdentifier, Beacon>();
            beacons.set(getBeaconInfoIdentifier(deadBeaconEvent), beacon);
            createMenu(deadBeaconEvent, {}, {}, beacons);
            expect(document.querySelector('a[aria-label="Open in OpenStreetMap"]')).toBeFalsy();
        });

        it("allows opening a location event in open street map", () => {
            const locationEvent = makeLocationEvent("geo:50,50");
            createMenu(locationEvent);
            // exists with a href with the lat/lon from the location event
            expect(document.querySelector('a[aria-label="Open in OpenStreetMap"]')).toHaveAttribute(
                "href",
                "https://www.openstreetmap.org/?mlat=50&mlon=50#map=16/50/50",
            );
        });

        it("allows opening a beacon that has a shareable location event", () => {
            const liveBeaconEvent = makeBeaconInfoEvent("@alice", roomId, { isLive: true });
            const beaconLocation = makeBeaconEvent("@alice", {
                beaconInfoId: liveBeaconEvent.getId(),
                geoUri: "geo:51,41",
            });
            const beacon = new Beacon(liveBeaconEvent);
            // @ts-ignore illegally set private prop
            beacon._latestLocationEvent = beaconLocation;
            const beacons = new Map<BeaconIdentifier, Beacon>();
            beacons.set(getBeaconInfoIdentifier(liveBeaconEvent), beacon);
            createMenu(liveBeaconEvent, {}, {}, beacons);
            // exists with a href with the lat/lon from the location event
            expect(document.querySelector('a[aria-label="Open in OpenStreetMap"]')).toHaveAttribute(
                "href",
                "https://www.openstreetmap.org/?mlat=51&mlon=41#map=16/51/41",
            );
        });
    });

    describe("right click", () => {
        it("copy button does work as expected", () => {
            const text = "hello";
            const eventContent = createMessageEventContent(text);
            mocked(getSelectedText).mockReturnValue(text);

            createRightClickMenuWithContent(eventContent);
            const copyButton = document.querySelector('li[aria-label="Copy"]')!;
            fireEvent.mouseDown(copyButton);
            expect(copyPlaintext).toHaveBeenCalledWith(text);
        });

        it("copy button is not shown when there is nothing to copy", () => {
            const text = "hello";
            const eventContent = createMessageEventContent(text);
            mocked(getSelectedText).mockReturnValue("");

            createRightClickMenuWithContent(eventContent);
            const copyButton = document.querySelector('li[aria-label="Copy"]');
            expect(copyButton).toBeFalsy();
        });

        it("shows edit button when we can edit", () => {
            const eventContent = createMessageEventContent("hello");
            mocked(canEditContent).mockReturnValue(true);

            createRightClickMenuWithContent(eventContent);
            const editButton = document.querySelector('li[aria-label="Edit"]');
            expect(editButton).toBeTruthy();
        });

        it("does not show edit button when we cannot edit", () => {
            const eventContent = createMessageEventContent("hello");
            mocked(canEditContent).mockReturnValue(false);

            createRightClickMenuWithContent(eventContent);
            const editButton = document.querySelector('li[aria-label="Edit"]');
            expect(editButton).toBeFalsy();
        });

        it("shows reply button when we can reply", () => {
            const eventContent = createMessageEventContent("hello");
            const context = {
                canSendMessages: true,
            };

            createRightClickMenuWithContent(eventContent, context);
            const replyButton = document.querySelector('li[aria-label="Reply"]');
            expect(replyButton).toBeTruthy();
        });

        it("does not show reply button when we cannot reply", () => {
            const eventContent = createMessageEventContent("hello");
            const context = {
                canSendMessages: true,
            };
            const unsentMessage = new MatrixEvent({ type: EventType.RoomMessage, content: eventContent });
            // queued messages are not actionable
            unsentMessage.setStatus(EventStatus.QUEUED);

            createMenu(unsentMessage, {}, context);
            const replyButton = document.querySelector('li[aria-label="Reply"]');
            expect(replyButton).toBeFalsy();
        });

        it("shows react button when we can react", () => {
            const eventContent = createMessageEventContent("hello");
            const context = {
                canReact: true,
            };

            createRightClickMenuWithContent(eventContent, context);
            const reactButton = document.querySelector('li[aria-label="React"]');
            expect(reactButton).toBeTruthy();
        });

        it("does not show react button when we cannot react", () => {
            const eventContent = createMessageEventContent("hello");
            const context = {
                canReact: false,
            };

            createRightClickMenuWithContent(eventContent, context);
            const reactButton = document.querySelector('li[aria-label="React"]');
            expect(reactButton).toBeFalsy();
        });

        it("shows view in room button when the event is a thread root", () => {
            const eventContent = createMessageEventContent("hello");
            const mxEvent = new MatrixEvent({ type: EventType.RoomMessage, content: eventContent });
            mxEvent.getThread = () => ({ rootEvent: mxEvent }) as Thread;
            const props = {
                rightClick: true,
            };
            const context = {
                timelineRenderingType: TimelineRenderingType.Thread,
            };

            createMenu(mxEvent, props, context);
            const reactButton = document.querySelector('li[aria-label="View in room"]');
            expect(reactButton).toBeTruthy();
        });

        it("does not show view in room button when the event is not a thread root", () => {
            const eventContent = createMessageEventContent("hello");

            createRightClickMenuWithContent(eventContent);
            const reactButton = document.querySelector('li[aria-label="View in room"]');
            expect(reactButton).toBeFalsy();
        });

        it("creates a new thread on reply in thread click", () => {
            const eventContent = createMessageEventContent("hello");
            const mxEvent = new MatrixEvent({ type: EventType.RoomMessage, content: eventContent });

            Thread.hasServerSideSupport = FeatureSupport.Stable;
            const context = {
                canSendMessages: true,
            };
            jest.spyOn(SettingsStore, "getValue").mockReturnValue(true);

            createRightClickMenu(mxEvent, context);

            const replyInThreadButton = document.querySelector('li[aria-label="Reply in thread"]')!;
            fireEvent.click(replyInThreadButton);

            expect(dispatcher.dispatch).toHaveBeenCalledWith({
                action: Action.ShowThread,
                rootEvent: mxEvent,
                push: false,
            });
        });
    });
});

function createRightClickMenuWithContent(eventContent: object, context?: Partial<IRoomState>): RenderResult {
    return createMenuWithContent(eventContent, { rightClick: true }, context);
}

function createRightClickMenu(mxEvent: MatrixEvent, context?: Partial<IRoomState>): RenderResult {
    return createMenu(mxEvent, { rightClick: true }, context);
}

function createMenuWithContent(
    eventContent: object,
    props?: Partial<MessageContextMenu["props"]>,
    context?: Partial<IRoomState>,
): RenderResult {
    // XXX: We probably shouldn't be assuming all events are going to be message events, but considering this
    // test is for the Message context menu, it's a fairly safe assumption.
    const mxEvent = new MatrixEvent({ type: EventType.RoomMessage, content: eventContent });
    return createMenu(mxEvent, props, context);
}

function makeDefaultRoom(): Room {
    return new Room(roomId, MatrixClientPeg.safeGet(), "@user:example.com", {
        pendingEventOrdering: PendingEventOrdering.Detached,
    });
}

function createMenu(
    mxEvent: MatrixEvent,
    props?: Partial<MessageContextMenu["props"]>,
    context: Partial<IRoomState> = {},
    beacons: Map<BeaconIdentifier, Beacon> = new Map(),
    room: Room = makeDefaultRoom(),
): RenderResult {
    const client = MatrixClientPeg.safeGet();

    // @ts-ignore illegally set private prop
    room.currentState.beacons = beacons;

    mxEvent.setStatus(EventStatus.SENT);

    client.getUserId = jest.fn().mockReturnValue("@user:example.com");
    client.getRoom = jest.fn().mockReturnValue(room);

    return render(
        <ScopedRoomContextProvider {...(context as IRoomState)}>
            <MessageContextMenu mxEvent={mxEvent} onFinished={jest.fn()} {...props} />
        </ScopedRoomContextProvider>,
    );
}
