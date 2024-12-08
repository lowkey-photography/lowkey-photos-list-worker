const options = {
	limit: 500,
};

// worker can be public so set cors headers
const corsHeaders = {
	'Access-Control-Allow-Headers': '*',
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET,HEAD,OPTIONS',
};

export interface ListPhotosResponseItem {
	imageDetails: ImageEntryDetails;
	isValidGalleryImage: boolean;
}

export interface ImageEntryDetails {
	month?: string;
	year?: string;
	album?: string;
	fileIndex: number;
	canonicalName: string;
}

function capitalize(value?: string): string | undefined {
	return value ? String(value).charAt(0).toUpperCase() + String(value).slice(1) : value;
}

function capitalizeLocation(value?: string): string | undefined {
	if (!value) {
		return value;
	}
	return String(value)
		.split('_')
		.map((i) => capitalize(i))
		.join(' ');
}

const areStringsSet = (stringFields: Array<string | undefined>) => stringFields.every((str) => str && str.length > 0);

function makeImageDetailsFromCanonicalname(canonicalName: string): ImageEntryDetails {
	const regex = /(?<month>[A-Za-z]+)-(?<year>[0-9]{4})-(?<place>[A-Za-z_]+)(?:-(?<index>[0-9]{1})){0,1}\.jpg$/;
	const match = canonicalName.match(regex);
	if (match) {
		return {
			month: capitalize(match.groups?.month),
			year: capitalize(match.groups?.year),
			album: capitalizeLocation(match.groups?.place),
			fileIndex: isNaN(Number(match.groups?.index)) ? -1 : Number(match.groups?.index),
			canonicalName: canonicalName,
		};
	}
	return { fileIndex: -1, canonicalName: canonicalName };
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		switch (request.method) {
			// handle CORS preflight
			case 'OPTIONS':
				return new Response('ok', { status: 200, headers: corsHeaders });
			case 'GET':
				const imageList = await env.lowkey_photos_bucket.list(options);
				let truncated = imageList.truncated;
				let cursor = imageList.truncated ? imageList.cursor : undefined;
				while (truncated) {
					const next = await env.lowkey_photos_bucket.list({ ...options, cursor: cursor });
					imageList.objects.push(...next.objects);
					truncated = next.truncated;
					cursor = next.truncated ? cursor : undefined;
				}
				let responseItems: Array<ListPhotosResponseItem> = [];
				imageList.objects.forEach((element) => {
					const imageDetails = makeImageDetailsFromCanonicalname(element.key);
					responseItems.push({
						imageDetails: imageDetails,
						isValidGalleryImage: areStringsSet([imageDetails.month, imageDetails.year, imageDetails.album]),
					} as ListPhotosResponseItem);
				});
				return new Response(JSON.stringify(responseItems), {
					headers: { ...corsHeaders, 'content-type': 'application/json' },
					status: 200,
				});

			default:
				return new Response(`${request.method} not supported`, {
					status: 405,
					headers: {
						...corsHeaders,
						Allow: 'GET',
					},
				});
		}
	},
} satisfies ExportedHandler<Env>;
