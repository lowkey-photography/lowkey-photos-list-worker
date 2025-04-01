const options = {
	limit: 500,
};

// worker can be public so set cors headers
const corsHeaders = {
	'Access-Control-Allow-Headers': '*',
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET,HEAD,OPTIONS',
};

const unsortedProjectTitle = 'Unsorted';

// ListPhotosResponse is the result of the ListPhotos API. It returns a map of project names to a list of keys in storage
// as strings
export interface ListPhotosResponse {
	projects: Map<string, string[]>;
}

function capitalize(value?: string): string | undefined {
	return value ? String(value).charAt(0).toUpperCase() + String(value).slice(1) : value;
}

function formatProjectMapKey(value?: string): string {
	return String(value)
		.split('_')
		.map((i) => capitalize(i))
		.join(' ')
		.trim();
}

// makeProjectMap  sorts each 'project' represented by each key in the Map, by its last modified date
// so the most recent pictures and the most recently updated portfolio subfolder is always on top
function makeProjectMap(objects: R2Object[]): Map<string, string[]> {
	let projectMap = new Map<string, string[]>();
	// sort by last updated date
	objects.sort((a, b) => b.uploaded.getTime() - a.uploaded.getTime());
	objects.forEach((element) => {
		// add unsorted images into a misc. collection
		const imageProject = formatProjectMapKey(element.key.split('/')[0]) ?? unsortedProjectTitle;
		projectMap.set(imageProject, [...(projectMap.get(imageProject) ?? []), element.key]);
	});
	// sort by filename
	projectMap.forEach((objects, _) => {
		objects.sort((a, b) => a.localeCompare(b));
	});
	return projectMap;
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
				const projectMap = makeProjectMap(imageList.objects);
				const respMap = Object.fromEntries(projectMap);
				return new Response(JSON.stringify(respMap), {
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
