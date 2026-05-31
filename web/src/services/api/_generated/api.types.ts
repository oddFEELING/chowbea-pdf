export interface paths {
    "/pdf/compress": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Compress one or more PDF files
         * @description Compress the uploaded PDFs and stream back the result.
         *
         *     A single file is returned as a PDF; multiple files are returned as a ZIP archive.
         *     Aggregate size stats are exposed via response headers so the UI can show savings.
         */
        post: operations["compress_pdf_compress_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Liveness check
         * @description Return a simple status payload used by load balancers and uptime checks.
         */
        get: operations["health_health_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        /** Body_compress_pdf_compress_post */
        Body_compress_pdf_compress_post: {
            /**
             * Files
             * @description One or more PDF files to compress.
             */
            files: string[];
            /**
             * @description Compression preset; 'screen' is smallest, 'prepress' is highest quality.
             * @default ebook
             */
            quality: components["schemas"]["CompressionQuality"];
        };
        /**
         * CompressionQuality
         * @description Quality presets that map directly to Ghostscript's -dPDFSETTINGS values.
         *
         *     Lower quality means smaller files: `screen` is the most aggressive,
         *     `prepress` preserves the most detail.
         * @enum {string}
         */
        CompressionQuality: "screen" | "ebook" | "printer" | "prepress";
        /** HTTPValidationError */
        HTTPValidationError: {
            /** Detail */
            detail?: components["schemas"]["ValidationError"][];
        };
        /** ValidationError */
        ValidationError: {
            /** Location */
            loc: (string | number)[];
            /** Message */
            msg: string;
            /** Error Type */
            type: string;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    compress_pdf_compress_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "multipart/form-data": components["schemas"]["Body_compress_pdf_compress_post"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    health_health_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: string;
                    };
                };
            };
        };
    };
}
