const options = {
	limit: 500,
	prefix: 'photodump_2023_resized/',
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

function makeImageDetailsFromCanonicalname(canonicalName: string): ImageEntryDetails {
	const regex = /(?<month>[A-Za-z]+)_(?<year>[0-9]{4})_(?<place>[A-Za-z]+)_(?<index>[0-9]{1}).jpg/;
	const match = canonicalName.match(regex);
	if (match) {
		return {
			month: capitalize(match.groups?.month),
			year: capitalize(match.groups?.year),
			album: capitalize(match.groups?.place),
			fileIndex: isNaN(Number(match.groups?.index)) ? -1 : Number(match.groups?.index),
			canonicalName: canonicalName,
		};
	}
	return { fileIndex: -1, canonicalName: canonicalName };
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		switch (request.method) {
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
						isValidGalleryImage: imageDetails.month && imageDetails.year && imageDetails.album && imageDetails.fileIndex > -1,
					} as ListPhotosResponseItem);
				});
				return new Response(JSON.stringify(responseItems), { status: 200 });

			default:
				return new Response(`${request.method} not supported`, {
					status: 405,
					headers: {
						Allow: 'GET',
					},
				});
		}
	},
} satisfies ExportedHandler<Env>;
