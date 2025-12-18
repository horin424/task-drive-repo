/* eslint-disable @typescript-eslint/no-explicit-any */
export function override(resources: any) {
  console.log('Starting override process...');

  const additionalAdminRoles = ["generationWorker-dev"];
  const current = resources.getParameter?.("adminRoles") ?? [];
  resources.setParameter?.("adminRoles", [...current, ...additionalAdminRoles]);
  
  try {
    // リソースが初期化されているか確認
    if (!resources || !resources.cdks) {
      console.log('Resources not initialized yet:', resources);
      return resources;
    }

    // 使用可能なCDKリソースを表示
    console.log('Available CDK resources:', Object.keys(resources.cdks));

    // APIリソースの取得を試みる
    const api = resources.cdks?.awsAppSync;
    if (!api) {
      console.log('AppSync API not found');
      return resources;
    }
    
    console.log('AppSync API found');

    // 以下のUserTableデータソースを探す設定は2025/06/13現在では機能していない。
    // データソースのリストを表示
    if (api.datasources) {
      console.log('Available datasources:', Object.keys(api.datasources));
    } else {
      console.log('No datasources available');
    }

    // UserTableデータソースを取得
    if (typeof api.ds !== 'function') {
      console.log('api.ds is not a function');
      return resources;
    }

    // UserTableデータソースを取得（Amplifyの標準命名規則）
    let userDataSource = api.ds("UserTable");
    
    // 見つからない場合は、利用可能なデータソースを調べる
    if (!userDataSource) {
      console.log('UserTable datasource not found, checking available datasources');
      const dsNames = Object.keys(api.datasources || {});
      console.log('Available datasources:', dsNames);
      
      // User関連のデータソースを探す
      const userDsName = dsNames.find(name => name.toLowerCase().includes('user'));
      
      if (userDsName) {
        userDataSource = api.ds(userDsName);
        console.log(`Found user datasource: ${userDsName}`);
      } else {
        console.log('No User-related datasource found.');
      }
    }
    
    // データソースが見つかった場合のみUnit Resolver を追加
    if (userDataSource) {
      console.log('Adding resolver for Mutation.createUserCustom');
      api.addUnitResolver(
        "Mutation",
        "createUserCustom",
        userDataSource,
        "Mutation.createUserCustom.req.vtl",
        "Mutation.createUserCustom.res.vtl"
      );
      console.log('Successfully added resolver for Mutation.createUserCustom');
    } else {
      console.log('Cannot add resolver: User datasource not found');
    }
  } catch (error) {
    console.log('Error in override:', error);
  }

  return resources;
}