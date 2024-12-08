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

export interface ListPhotosResponse {
	projects: Map<string, R2Object[]>;
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

function makeProjectMap(objects: R2Object[]): Map<string, R2Object[]> {
	let projectMap = new Map<string, R2Object[]>();
	objects.forEach((element) => {
		// add unsorted images into a misc. collection
		const imageProject = formatProjectMapKey(element.key.split('/')[0]) ?? unsortedProjectTitle;
		projectMap.set(imageProject, [...(projectMap.get(imageProject) ?? []), element as R2Object]);
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
