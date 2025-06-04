import React, { type JSX, createRef } from "react";
import { logger } from "matrix-js-sdk/src/logger";
import { _t } from "../../../languageHandler";

const TURNSTILE_ID = "mx_turnstile";

// Biến global để theo dõi trạng thái script và widget
let turnstileScriptPromise: Promise<void> | null = null;
let turnstileWidgetCount = 0;

declare global {
    interface Window {
        turnstile?: {
            render: (
                container: string | HTMLElement,
                options: {
                    sitekey: string;
                    callback: (token: string) => void;
                },
            ) => string;
            reset: (widgetId: string) => void;
        };
    }
}

interface ICaptchaFormProps {
    sitePublicKey: string;
    onCaptchaResponse: (response: string) => void;
}

interface ICaptchaFormState {
    errorText?: string;
    isWidgetRendered: boolean;
}

export default class CaptchaForm extends React.Component<ICaptchaFormProps, ICaptchaFormState> {
    public static defaultProps = {
        onCaptchaResponse: () => {},
    };

    private turnstileWidgetId?: string;
    private turnstileContainer = createRef<HTMLDivElement>();
    private isComponentMounted = false;

    constructor(props: ICaptchaFormProps) {
        super(props);
        this.state = {
            errorText: undefined,
            isWidgetRendered: false,
        };
    }

    private loadTurnstileScript(): Promise<void> {
        if (turnstileScriptPromise) {
            return turnstileScriptPromise;
        }

        turnstileScriptPromise = new Promise((resolve, reject) => {
            const existingScript = document.querySelector(
                'script[src^="https://challenges.cloudflare.com/turnstile/"]',
            );

            if (existingScript) {
                if (this.isTurnstileReady()) {
                    resolve();
                } else {
                    reject(new Error("Turnstile script no loaded "));
                }
                return;
            }

            const script = document.createElement("script");
            script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
            script.async = true;

            script.onload = () => {
                if (this.isTurnstileReady()) {
                    resolve();
                } else {
                    reject(new Error("Turnstile script loaded but not ready"));
                }
            };

            script.onerror = () => {
                reject(new Error("Failed to load Turnstile script"));
            };

            document.head.appendChild(script);
        });

        return turnstileScriptPromise;
    }

    private isTurnstileReady(): boolean {
        return (
            typeof window !== "undefined" &&
            typeof window.turnstile !== "undefined" &&
            typeof window.turnstile.render === "function"
        );
    }

    private async initializeTurnstile(): Promise<void> {
        if (!this.isComponentMounted || this.state.isWidgetRendered) {
            return;
        }
        try {
            await this.loadTurnstileScript();
            this.renderTurnstile();
        } catch (error) {
            if (this.isComponentMounted) {
                this.setState({
                    errorText: error instanceof Error ? error.message : String(error),
                });
            }
        }
    }

    private renderTurnstile(): void {
        if (!this.isComponentMounted || !this.turnstileContainer.current || !this.isTurnstileReady()) {
            return;
        }

        if (this.state.isWidgetRendered) {
            logger.warn("Turnstile widget already rendered");
            return;
        }

        try {
            const publicKey = "0x4AAAAAABfxOk3QuexiBOyI";
            this.turnstileWidgetId = window.turnstile?.render(this.turnstileContainer.current, {
                sitekey: publicKey,
                callback: (token: string) => {
                    logger.info("Turnstile verification successful", token);
                    this.props.onCaptchaResponse(token);
                },
            });

            turnstileWidgetCount++;
            this.setState({
                isWidgetRendered: true,
                errorText: undefined,
            });
        } catch (e) {
            logger.error("Error rendering Turnstile:", e);
            if (this.isComponentMounted) {
                this.setState({
                    errorText: e instanceof Error ? e.message : String(e),
                });
            }
        }
    }

    public componentDidMount(): void {
        this.isComponentMounted = true;
        this.initializeTurnstile();
    }

    public componentWillUnmount(): void {
        this.isComponentMounted = false;

        if (this.turnstileWidgetId && window.turnstile) {
            try {
                window.turnstile.reset(this.turnstileWidgetId);
                turnstileWidgetCount--;

                // Nếu không còn widget nào, reset script promise
                if (turnstileWidgetCount === 0) {
                    const script = document.querySelector(
                        'script[src^="https://challenges.cloudflare.com/turnstile/"]',
                    );
                    if (script) {
                        script.remove();
                    }
                    turnstileScriptPromise = null;
                }
            } catch (e) {
                logger.error("Error resetting Turnstile:", e);
            }
        }
    }

    public render(): JSX.Element {
        return (
            <div>
                <p>{_t("auth|captcha_description")}</p>
                <div
                    ref={this.turnstileContainer}
                    id={TURNSTILE_ID}
                    className="cf-turnstile"
                    data-sitekey="0x4AAAAAABfxOk3QuexiBOyI"
                ></div>
            </div>
        );
    }
}
