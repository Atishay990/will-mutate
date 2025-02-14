module.exports = {
	"globals": {
		"$shouldNotMutate": "readonly",
	},

	"plugins": [
		"evelyn",
	],

	"extends": [
		"plugin:evelyn/default",
		"plugin:evelyn/typescript",
	],

	"overrides": [
		{
			"files": [
				"**/*.test.js",
				"**/__mocks__/**/*.js",
				"**/__tests__/**/*.js",
				"config/setup-after-env.js",
			],
			"extends": [
				"plugin:evelyn/jest",
			],
		},
		{
			"files": [
				"**/__fixtures__/**/*.js",
			],
			"rules": {
				"no-unused-vars": "off",
			},
		},
	],

	"ignorePatterns": [
		"src/foo.js",
		"lib/foo.js",
		"**/__fixtures__/**/output.js",
	],
};
