import { articleCode, type PostSpec } from './x-dom';

/** Reproduces the structure of the X Article observed on x.com (October 2026). */
export const ARTICLE_POST: PostSpec = {
  id: '2105380835675312294',
  handle: 'make_claude',
  name: 'make claude',
  verified: true,
  text: '',
  article: {
    title: 'JEV ne veut pas remplacer Claude',
    body: [
      '<p><span>La plupart des agents IA appellent un modèle coûteux à chaque étape.</span></p>',
      '<p><span>Même pour </span><b><strong>un seul bit</strong></b><span> d’information, et </span><i><em>des milliers</em></i><span> de tokens.</span></p>',
      '<hr>',
      '<p><span>Je suis </span><a href="https://x.com/Make_claude" target="_blank" rel="noopener noreferrer"><span>@Make_claude</span></a><span>.</span></p>',
      '<hr>',
      '<figure><div><a href="/make_claude/article/2105380835675312294/media/1"><img alt="" src="https://pbs.twimg.com/media/HTfIevoXYAAuKZJ.jpg" width="1254" height="1254"></a></div></figure>',
      '<hr>',
      '<h3><span>Jev en commande shell</span></h3>',
      '<p><span>Installer la CLI :</span></p></div>',
      articleCode('bash', ['npm install -g @y0usaf/typesafe-cli']),
      '<div><p><span>Exemple :</span></p></div>',
      articleCode('bash', ['jev noul \\', '  "Does this need a refund?"']),
      '<div><ul><li><span>moins cher</span></li><li><b><strong>plus rapide</strong></b></li></ul>',
      '<blockquote><span>La question est de savoir si l’appel doit exister.</span></blockquote>',
    ].join(''),
  },
};
