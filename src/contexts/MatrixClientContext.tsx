/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The nobody.network Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ComponentClass, createContext, useContext } from "react";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";

// This context is available to components under LoggedInView,
// the context must not be used by components outside a MatrixClientContext tree.
// This assertion allows us to make the type not nullable.
const MatrixClientContext = createContext<MatrixClient>(null as any);
MatrixClientContext.displayName = "MatrixClientContext";
export default MatrixClientContext;

export interface MatrixClientProps {
    mxClient: MatrixClient;
}

export function useMatrixClientContext(): MatrixClient {
    return useContext(MatrixClientContext);
}

const matrixHOC =
    <ComposedComponentProps extends object>(
        ComposedComponent: ComponentClass<ComposedComponentProps>,
    ): ((
        props: Omit<ComposedComponentProps, "mxClient"> & React.RefAttributes<InstanceType<typeof ComposedComponent>>,
    ) => React.ReactElement | null) =>
    (props) => {
        const client = useContext(MatrixClientContext);

        // @ts-ignore
        return <ComposedComponent {...props} mxClient={client} />;
    };
export const withMatrixClientHOC = matrixHOC;
