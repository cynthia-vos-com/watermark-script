import * as fs from 'fs';
import im from 'imagemagick';
import Jimp from 'jimp';
import * as path from 'path';

const inputPath = path.resolve('./input');
const outputPath = path.resolve('./output');
const watermark = path.resolve('./watermark.png');

const LOGO_MARGIN_PERCENTAGE = 5;
const LOGO_OPACITY_PERCENTAGE = 100;
const IMAGE_MAX_WIDTH = 1000;

interface File {
	file: string;
	directory: string;
}

interface ImageWithJimp extends File {
	jimp: Jimp;
}

interface ImageWithWatermark extends ImageWithJimp {
	watermarked: Jimp;
}

const readDirectory = (dir = inputPath): File[] => {
	const read = fs.readdirSync(dir, { withFileTypes: true });
	const directories = read
		.filter((d) => d.isDirectory())
		.map((d) => `${dir}/${d.name}`);

	let files = read
		.filter((f) => f.isFile())
		.map((f) => ({
			file: `${dir}/${f.name}`,
			directory: dir,
		}));

	if (!files?.length) {
		return [];
	}

	for (let directory of directories) {
		const directoryFiles = readDirectory(directory);
		files = [...files, ...directoryFiles];
	}

	return files;
};

const convertFile = async (file: File): Promise<File> => {
	const newPath = file.file.replace(inputPath, outputPath);
	const splitted = newPath.split('.');
	splitted.pop();

	const renamedDest = `${splitted.join('.')}.jpg`;

	const promise = new Promise((resolve, reject) => {
		im.convert([file.file, '-size', '1000', renamedDest], (err, stdOut) => {
			if (err) return reject(err);
			return resolve(stdOut);
		});
	});

	await promise;
	return {
		...file,
		file: renamedDest,
	};
};

const parseFile = async (file: File): Promise<ImageWithJimp | null> => {
	const jimp = await Jimp.read(file.file).catch(() => undefined);

	if (!jimp) {
		return null;
	}

	return {
		...file,
		jimp,
	};
};

const applyWatermark = async (
	file: ImageWithJimp
): Promise<ImageWithWatermark> => {
	const logo = await Jimp.read(watermark);
	const image = file.jimp;

	logo.resize(
		image.bitmap.width -
			image.bitmap.width * (LOGO_MARGIN_PERCENTAGE / 100) * 2,
		Jimp.AUTO
	);

	const X = (image.bitmap.width - logo.bitmap.width) / 2;
	const Y = (image.bitmap.height - logo.bitmap.height) / 2;

	const scale = IMAGE_MAX_WIDTH / image.bitmap.width;

	return {
		...file,
		watermarked: await image
			.composite(logo, X, Y, {
				mode: Jimp.BLEND_SCREEN,
				opacitySource: LOGO_OPACITY_PERCENTAGE / 100,
				opacityDest: 1,
			})
			.scale(scale),
	};
};

const writeFile = (image: ImageWithWatermark) => {
	return image.watermarked.write(path.resolve(image.file));
};

const processFile = async (file: File) => {
	console.log(`┬ Running file: ${file?.file}`);
	const converted = await convertFile(file);
	console.log(`├ Converted`);
	const parsed = await parseFile(converted);

	if (!parsed) {
		console.log(`└ Couldn't parse, skipping.\n\n`);
		return;
	}
	console.log(`├ Parsed`);

	const watermarked = await applyWatermark(parsed);
	console.log(`├ Watermarked`);
	await writeFile(watermarked);
	console.log(`└ Saved.\n`);
};

(async () => {
	console.log(`─ Reading directory: ${inputPath}`);
	const files = readDirectory();

	for (const file of files) {
		await processFile(file);
	}
})();
