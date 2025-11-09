const ejs = require('ejs');
const path = require('path');

/**
 * Render the complete result HTML (with layout) for a given order
 * This generates the exact same HTML that would be displayed on the website
 */
async function renderResultHTML(templateName, templateData) {
  const viewsPath = path.join(__dirname, '../views');
  
  // Render the result template (which includes header via include)
  const templatePath = path.join(viewsPath, `${templateName}.ejs`);
  const resultHTML = await ejs.renderFile(templatePath, templateData, {
    root: viewsPath,
    views: viewsPath
  });
  
  // Now render the full layout with the result content
  const layoutPath = path.join(viewsPath, 'layout.ejs');
  const layoutData = {
    ...templateData,
    body: resultHTML // The rendered result template becomes the body
  };
  
  const fullHTML = await ejs.renderFile(layoutPath, layoutData, {
    root: viewsPath,
    views: viewsPath
  });
  
  return fullHTML;
}

module.exports = {
  renderResultHTML
};
