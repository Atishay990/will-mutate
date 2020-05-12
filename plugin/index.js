const {looksLike, isModuleExports} = require("./looks-like");
const t = require("@babel/types");
const {default: traverse} = require("@babel/traverse");
const parser = require("@babel/parser");
const fs = require("fs");

const proxifyFnName = "_will_mutate_check_proxify";
const proxyCode = fs.readFileSync(`${__dirname}/proxy.js`, "utf8");
const proxyAST = parser.parse(proxyCode);
const proxyBodyAST = proxyAST.program.body.filter(node => !isModuleExports(node));

/**
 * The "Map" of if the "./proxy.js" code should be injected to the top of the Program
 */
const Programs = new WeakMap();

/**
 * @param {string} variableName - The name of the variable to mock out with `proxify`
 */
const getVariableMockCodeAST = (variableName) => {
	const newVarName = `_will_mutate_check_${variableName}`;
	const codeAST = parser.parse(`
        const ${newVarName} = ${proxifyFnName}(${variableName});
    `.trim()).program.body;
	return {
		codeAST,
		newVarName,
		oldVarName: variableName,
	};
};

module.exports = () => {
	return {
		name: "willMutate",
		visitor: {
			/**
             * We need to traverse the "Program" so we can know if we need to inject
             * the Proxy handler or not.
             */
			Program: {
				enter(programPath) {
					traverse(programPath.node, {
						noScope: true,
						enter(decoratorPath) {
							/**
                             * Look for all $shouldNotMutate functions
                             */
							if (decoratorPath.node.type === "ExpressionStatement") {
								const isFunc = looksLike(decoratorPath, {
									node: {
										type: "ExpressionStatement",
										expression: {
											callee: {
												name: "$shouldNotMutate",
											},
										},
									},
								});

								if (!isFunc) return;

								const notMutateArgs = decoratorPath.node.expression.arguments;

								let inBodyArgsToProxy = [];
								if (notMutateArgs.length) {
									// We expect the first item in the array to be an array of strings
									inBodyArgsToProxy = notMutateArgs[0].elements.map(node => node.value);
								}

								decoratorPath.remove();

								/**
                                 * Tell the compiler to inject the `proxify` code at the top of the file
                                 */
								Programs.set(programPath.node, true);

								// Treat the function as a "decorator" for a function. AKA get the function immediately
								// After the function itself
								const functionNodePath = decoratorPath.getSibling(decoratorPath.key + 1);

								// Traverse the path to get the "BlockStatement" so we can mutate the code on it's own
								traverse(functionNodePath.node, {
									noScope: true,
									enter(blockStatementPath) {
										// This is the "body" of the function we're trying to mock data out of
										if (blockStatementPath.node.type === "BlockStatement") {

											const mockCodeArr = inBodyArgsToProxy.map(varNameToChange => getVariableMockCodeAST(varNameToChange));

											// Flat map since the `codeAST` is itself an array
											const codeASTToAppend = mockCodeArr.flatMap(val => val.codeAST);

											blockStatementPath.node.body = [...codeASTToAppend, ...blockStatementPath.node.body];

											traverse(blockStatementPath.node, {
												noScope: true,
												enter(identifierPath) {
													if (
														identifierPath.node.type === "Identifier"
													) {
														const val = mockCodeArr.find(val => val.oldVarName === identifierPath.node.name);
														// If it's not an identifier we need, ignore it
														if (!val) return;
														// If this LOC isn't present, then it will mutate the variable name of the __proxify function
														if (identifierPath.parent.type === "CallExpression" && identifierPath.parent.callee.name === proxifyFnName) return;
														identifierPath.replaceWith(t.identifier(val.newVarName));
													}
												},
											});
										}
									},
								});
							}
						},
					});
				},
				exit(programPath) {
					const val = Programs.get(programPath.node);
					/**
                     * If the Program has any utilization of the $shouldNotMutate, then we'll inject the code from the
                     * proxy.js file to then be able to use that function in the AST
                     */
					if (val) {
						programPath.node.body = [...proxyBodyAST, ...programPath.node.body];
					}
				},
			},
		},
	};
};

function createVoid0() {
	return t.unaryExpression("void", t.numericLiteral(0));
}
